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

/**
 * Always need a label: nothing inside them names the control. Any tag ending
 * in "Input" counts, so aliased inputs (NoteInput, a passed-in Input) and
 * TimeInput are covered too.
 */
const LABELLED_TAGS = ["Switch", "Checkbox", "RadioButton", "\\w*Input"];
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
/**
 * A control inside an accessible touchable is merged into it: VoiceOver reads
 * its text but activating it runs the outer onPress.
 */
const NESTED_CONTROL =
  /<(TouchableOpacity|TouchableHighlight|Pressable|Button|AppButton|AppIconButton|Switch|Checkbox|\w*Input)\b/;
/** True when `body` holds a control that is not hidden from screen readers. */
function hasReachableControl(body: string): boolean {
  const pattern = new RegExp(NESTED_CONTROL.source, "g");
  for (const match of body.matchAll(pattern)) {
    const start = match.index!;
    const opening = body.slice(start, endOfOpeningTag(body, start + 1));
    if (!HIDDEN_PROP.test(opening)) return true;
  }
  return false;
}

/** A touchable styled as on/off or open/closed must say which it is. */
const STATEFUL_HINT =
  /styles\.\w*(Active|Selected)\b|setExpanded|setIsExpanded|\btoggle[A-Z]\w*|onToggleExpand|setCollapsed/;

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

/**
 * Section titles are how screen reader users skim a screen: they jump from
 * header to header. Text styled as a section title must say it is one.
 */
function findUnmarkedHeadings(source: string, file: string): string[] {
  const problems: string[] = [];
  const pattern =
    /<(ThemedText|Text|AppText)\b(?=[^>]*style=\{styles\.(sectionTitle|sectionHeader)\})/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index!;
    const end = endOfOpeningTag(source, start + match[0].length);
    if (!/accessibilityRole="header"/.test(source.slice(start, end))) {
      const line = source.slice(0, start).split("\n").length;
      problems.push(`${path.relative(ROOT, file)}:${line} section title`);
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
  // Commented-out JSX is not rendered.
  const withoutComments = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) =>
    c.replace(/[^\n]/g, " "),
  );

  for (const tag of [...LABELLED_TAGS, ...TOUCHABLE_TAGS]) {
    const pattern = new RegExp(
      `(?<![\\w.])<(${tag.replace(".", "\\.")})(?=[\\s/>])`,
      "g",
    );
    for (const match of withoutComments.matchAll(pattern)) {
      const start = match.index!;
      const name = match[1];
      const end = endOfOpeningTag(withoutComments, start + match[0].length);
      const opening = withoutComments.slice(start, end);
      const hidden = HIDDEN_PROP.test(opening);

      if (TOUCHABLE_TAGS.includes(tag)) {
        const optedOut = /accessible=\{false\}/.test(opening);
        if (!opening.endsWith("/>") && !optedOut && !hidden) {
          const body = withoutComments.slice(
            end,
            withoutComments.indexOf(`</${name}>`, end),
          );
          if (hasReachableControl(body)) {
            problems.push(`${where(start, name)} wraps another control`);
          }
        }
        if (
          STATEFUL_HINT.test(opening) &&
          !/accessibilityState=/.test(opening)
        ) {
          problems.push(`${where(start, name)} needs accessibilityState`);
        }
        // Without a role a screen reader reads the text but never says
        // "button", so the user cannot tell it does anything.
        if (
          !hidden &&
          !/accessibilityRole=|accessible=\{false\}/.test(opening)
        ) {
          problems.push(`${where(start, name)} needs accessibilityRole`);
        }
        if (LABEL_PROP.test(opening) || hidden) continue;
        if (!opening.endsWith("/>")) {
          const close = withoutComments.indexOf(`</${name}>`, end);
          if (TEXT_CHILD.test(withoutComments.slice(end, close))) continue;
        }
        problems.push(`${where(start, name)} needs accessibilityLabel`);
        continue;
      }

      if (LABEL_PROP.test(opening) || hidden) continue;
      problems.push(`${where(start, name)} needs accessibilityLabel`);
    }
  }
  return [
    ...problems,
    ...findGroupingWrappers(source, file),
    ...findUnmarkedHeadings(source, file),
  ];
}

describe("accessibility labels", () => {
  it("every control has a label and no wrapper hides a dialog's contents", () => {
    const files = SCANNED_DIRS.flatMap((dir) =>
      listFiles(path.join(ROOT, dir)),
    );
    // Guards against the scan silently finding nothing.
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap(findUnlabelled)).toEqual([]);
  });
});
