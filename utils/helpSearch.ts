import Fuse, { type IFuseOptions } from "fuse.js";

export type TranslatedBody =
  | string
  | { lead: string; steps: string[]; ordered: boolean };

export type SearchableSection = {
  id: string;
  title: string;
  body: TranslatedBody;
};

export type SearchableGroup = {
  id: string;
  group: string;
  sections: SearchableSection[];
};

export type CharRange = [number, number];

type HelpDoc = {
  groupId: string;
  sectionId: string;
  title: string;
  bodyFlat: string;
  // Per-step [start, end) offsets into bodyFlat; null for prose bodies.
  stepRanges: CharRange[] | null;
};

export type SectionMatch = {
  groupId: string;
  sectionId: string;
  titleRanges: CharRange[];
  bodyRanges: CharRange[];
  matchedStepIndices: number[];
};

export type HelpSearchResult = {
  matches: Map<string, SectionMatch>;
  matchedGroupIds: Set<string>;
};

export type TextSegment = { text: string; highlighted: boolean };

export function isTranslatedStepsBody(
  body: TranslatedBody,
): body is { lead: string; steps: string[]; ordered: boolean } {
  return typeof body === "object" && body !== null && "steps" in body;
}

export function flattenBody(body: TranslatedBody): {
  text: string;
  stepRanges: CharRange[] | null;
} {
  if (typeof body === "string") return { text: body, stepRanges: null };

  const parts: string[] = [body.lead];
  const stepRanges: CharRange[] = [];
  let cursor = body.lead.length;
  for (const step of body.steps) {
    cursor += 1; // separator space joining parts
    const start = cursor;
    parts.push(step);
    cursor += step.length;
    stepRanges.push([start, cursor]);
  }
  return { text: parts.join(" "), stepRanges };
}

function buildDocs(groups: SearchableGroup[]): HelpDoc[] {
  const docs: HelpDoc[] = [];
  for (const group of groups) {
    for (const section of group.sections) {
      const { text, stepRanges } = flattenBody(section.body);
      docs.push({
        groupId: group.id,
        sectionId: section.id,
        title: section.title,
        bodyFlat: text,
        stepRanges,
      });
    }
  }
  return docs;
}

const fuseOptions: IFuseOptions<HelpDoc> = {
  keys: [
    { name: "title", weight: 2 },
    { name: "bodyFlat", weight: 1 },
  ],
  includeMatches: true,
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
};

export function buildHelpIndex(groups: SearchableGroup[]): Fuse<HelpDoc> {
  return new Fuse(buildDocs(groups), fuseOptions);
}

function rangesForKey(
  matches:
    | readonly { key?: string; indices: readonly CharRange[] }[]
    | undefined,
  key: string,
): CharRange[] {
  if (!matches) return [];
  const ranges: CharRange[] = [];
  for (const m of matches) {
    if (m.key !== key) continue;
    for (const [start, end] of m.indices) {
      ranges.push([start, end + 1]); // Fuse indices are inclusive on both ends
    }
  }
  return ranges;
}

function stepIndicesForRanges(
  stepRanges: CharRange[] | null,
  bodyRanges: CharRange[],
): number[] {
  if (!stepRanges) return [];
  const indices = new Set<number>();
  for (const [start, end] of bodyRanges) {
    stepRanges.forEach(([stepStart, stepEnd], i) => {
      if (start < stepEnd && end > stepStart) indices.add(i);
    });
  }
  return [...indices].sort((a, b) => a - b);
}

export function searchHelp(
  index: Fuse<HelpDoc>,
  query: string,
): HelpSearchResult {
  const matches = new Map<string, SectionMatch>();
  const matchedGroupIds = new Set<string>();
  if (!query.trim()) return { matches, matchedGroupIds };

  for (const result of index.search(query)) {
    const titleRanges = rangesForKey(result.matches, "title");
    const bodyRanges = rangesForKey(result.matches, "bodyFlat");
    matches.set(result.item.sectionId, {
      groupId: result.item.groupId,
      sectionId: result.item.sectionId,
      titleRanges,
      bodyRanges,
      matchedStepIndices: stepIndicesForRanges(
        result.item.stepRanges,
        bodyRanges,
      ),
    });
    matchedGroupIds.add(result.item.groupId);
  }
  return { matches, matchedGroupIds };
}

/**
 * Extracts a word-boundary-clamped window of `text` centered on the earliest
 * match range, remapping the ranges into the snippet's local coordinate space.
 */
export function extractSnippet(
  text: string,
  ranges: CharRange[],
  windowSize = 100,
): { text: string; ranges: CharRange[] } {
  if (ranges.length === 0 || text.length <= windowSize) {
    return { text, ranges };
  }

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const [matchStart, matchEnd] = sorted[0];
  const half = Math.max(
    0,
    Math.floor((windowSize - (matchEnd - matchStart)) / 2),
  );

  let start = Math.max(0, matchStart - half);
  let end = Math.min(text.length, matchEnd + half);

  while (start > 0 && /\S/.test(text[start - 1])) start--;
  while (end < text.length && /\S/.test(text[end])) end++;

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const snippetText = prefix + text.slice(start, end) + suffix;
  const offset = start - prefix.length;

  const localRanges = ranges
    .map(([s, e]): CharRange => [s - offset, e - offset])
    .filter(([s, e]) => s >= 0 && e <= snippetText.length);

  return { text: snippetText, ranges: localRanges };
}

/**
 * Remaps body-level match ranges onto a single step's local coordinate space,
 * keeping only the portions that fall within that step.
 */
export function stepLocalHighlightRanges(
  stepRange: CharRange,
  bodyRanges: CharRange[],
): CharRange[] {
  const [stepStart, stepEnd] = stepRange;
  return bodyRanges
    .filter(([s, e]) => s < stepEnd && e > stepStart)
    .map(
      ([s, e]): CharRange => [
        Math.max(s, stepStart) - stepStart,
        Math.min(e, stepEnd) - stepStart,
      ],
    );
}

/**
 * Splits `text` into highlighted/plain segments for rendering, given a set of
 * (possibly overlapping or unordered) character ranges to highlight.
 */
export function toSegments(text: string, ranges: CharRange[]): TextSegment[] {
  if (ranges.length === 0) return [{ text, highlighted: false }];

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of sorted) {
    const s = Math.max(start, cursor);
    const e = Math.max(end, s);
    if (s > cursor)
      segments.push({ text: text.slice(cursor, s), highlighted: false });
    if (e > s) segments.push({ text: text.slice(s, e), highlighted: true });
    cursor = Math.max(cursor, e);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }
  return segments;
}
