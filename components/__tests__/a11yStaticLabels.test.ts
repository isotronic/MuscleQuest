/**
 * Static guard for screen reader labels. Controls whose purpose is not carried
 * by their own text must declare an accessibilityLabel, or TalkBack/VoiceOver
 * users hear only "switch", "edit box" or "button". Icon-only Paper
 * IconButtons are covered by the AppIconButton type and an ESLint rule.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SCANNED_DIRS = ["app", "components"];

/** Always need a label: nothing inside them names the control. */
const LABELLED_TAGS = ["Switch", "TextInput", "Checkbox"];
/** Need a label only when they wrap no text. */
const TOUCHABLE_TAGS = [
  "TouchableOpacity",
  "TouchableHighlight",
  "Pressable",
  "Sortable.Touchable",
];

// Label sources other than a literal accessibilityLabel prop: Paper's
// floating `label`, and the checkboxLabel() helper spread onto Checkbox.
const LABEL_PROP = /\baccessibilityLabel=|\blabel=|checkboxLabel\(/;
const HIDDEN_PROP = /importantForAccessibility="no(-hide-descendants)?"/;
const TEXT_CHILD = /<(ThemedText|Text|AppText|Trans|Plural)\b|\{t`|\btitle=/;

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listFiles(full);
    }
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

/** Index just past the `>` closing a JSX opening tag, skipping `{...}`. */
function endOfOpeningTag(source: string, from: number): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i + 1;
  }
  return source.length;
}

/**
 * TouchableWithoutFeedback makes its child accessible unless told otherwise.
 * Used as a modal backdrop, that turns the whole dialog into one element that
 * VoiceOver cannot look inside. Opt out with accessible={false}, or declare
 * accessibilityRole when the wrapper really is the control.
 */
function findGroupingWrappers(source: string, file: string): string[] {
  const problems: string[] = [];
  for (const match of source.matchAll(/<TouchableWithoutFeedback(?=[\s/>])/g)) {
    const start = match.index!;
    const end = endOfOpeningTag(source, start + match[0].length);
    // Either opt out, or declare the role when the wrapper is the control.
    const opening = source.slice(start, end);
    if (!/accessible=\{false\}|accessibilityRole=/.test(opening)) {
      const line = source.slice(0, start).split("\n").length;
      problems.push(
        `${path.relative(ROOT, file)}:${line} <TouchableWithoutFeedback>`,
      );
    }
  }
  return problems;
}

function findUnlabelled(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const problems: string[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  const where = (index: number, tag: string) =>
    `${path.relative(ROOT, file)}:${lineOf(index)} <${tag}>`;

  for (const tag of [...LABELLED_TAGS, ...TOUCHABLE_TAGS]) {
    const pattern = new RegExp(
      `(?<![\\w.])<${tag.replace(".", "\\.")}(?=[\\s/>])`,
      "g",
    );
    for (const match of source.matchAll(pattern)) {
      const start = match.index!;
      const end = endOfOpeningTag(source, start + match[0].length);
      const opening = source.slice(start, end);
      const hidden = HIDDEN_PROP.test(opening);

      if (TOUCHABLE_TAGS.includes(tag)) {
        // Without a role a screen reader reads the text but never says
        // "button", so the user cannot tell it does anything.
        if (
          !hidden &&
          !/accessibilityRole=|accessible=\{false\}/.test(opening)
        ) {
          problems.push(`${where(start, tag)} needs accessibilityRole`);
        }
        if (LABEL_PROP.test(opening) || hidden) continue;
        if (!opening.endsWith("/>")) {
          const close = source.indexOf(`</${tag}>`, end);
          if (TEXT_CHILD.test(source.slice(end, close))) continue;
        }
        problems.push(`${where(start, tag)} needs accessibilityLabel`);
        continue;
      }

      if (LABEL_PROP.test(opening) || hidden) continue;
      problems.push(`${where(start, tag)} needs accessibilityLabel`);
    }
  }
  return [...problems, ...findGroupingWrappers(source, file)];
}

describe("accessibility labels", () => {
  it("every control has a label and no wrapper hides a dialog's contents", () => {
    const problems = SCANNED_DIRS.flatMap((dir) =>
      listFiles(path.join(ROOT, dir)),
    ).flatMap(findUnlabelled);
    expect(problems).toEqual([]);
  });
});
