import {
  buildHelpIndex,
  searchHelp,
  extractSnippet,
  toSegments,
  stepLocalHighlightRanges,
  SearchableGroup,
} from "../helpSearch";

const GROUPS: SearchableGroup[] = [
  {
    id: "training",
    group: "Training",
    sections: [
      {
        id: "supersets",
        title: "Supersets",
        body: "Group two exercises into a superset so they alternate automatically during a session.",
      },
      {
        id: "rest-timer",
        title: "Rest Timer",
        body: {
          lead: "The rest timer starts automatically after each set.",
          steps: [
            "Use the plus/minus buttons to adjust the remaining time.",
            "Configure the default rest duration in Settings.",
          ],
          ordered: false,
        },
      },
    ],
  },
  {
    id: "account",
    group: "Account",
    sections: [
      {
        id: "signing-in",
        title: "Signing In",
        body: "Tap Sign In With Google in Settings to connect your account.",
      },
    ],
  },
];

// ─── searchHelp ────────────────────────────────────────────────────────────

describe("searchHelp", () => {
  it("returns no matches for an empty query", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "");
    expect(result.matches.size).toBe(0);
    expect(result.matchedGroupIds.size).toBe(0);
  });

  it("finds an exact title match", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "Supersets");
    expect(result.matches.has("supersets")).toBe(true);
    expect(result.matchedGroupIds.has("training")).toBe(true);
  });

  it("finds a fuzzy/typo match", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "supersett");
    expect(result.matches.has("supersets")).toBe(true);
  });

  it("matches a query that only appears in the group name context via section content", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "Google");
    expect(result.matches.has("signing-in")).toBe(true);
    expect(result.matchedGroupIds.has("account")).toBe(true);
  });

  it("maps a body match back to the specific step it fell in", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "default rest duration");
    const match = result.matches.get("rest-timer");
    expect(match).toBeDefined();
    expect(match!.matchedStepIndices).toContain(1);
  });

  it("returns empty matches for a query with no reasonable match", () => {
    const index = buildHelpIndex(GROUPS);
    const result = searchHelp(index, "zzz-nonexistent-xyz-123");
    expect(result.matches.size).toBe(0);
  });
});

// ─── extractSnippet ────────────────────────────────────────────────────────

describe("extractSnippet", () => {
  it("returns the full text unchanged when it fits within the window", () => {
    const text = "Short body text.";
    const result = extractSnippet(text, [[0, 5]], 100);
    expect(result.text).toBe(text);
    expect(result.ranges).toEqual([[0, 5]]);
  });

  it("returns the full text unchanged when there are no ranges", () => {
    const text = "a".repeat(200);
    const result = extractSnippet(text, [], 100);
    expect(result.text).toBe(text);
  });

  it("truncates with a leading ellipsis when the match is near the end", () => {
    const text = "word ".repeat(60).trim(); // long text
    const matchStart = text.length - 4;
    const matchEnd = text.length;
    const result = extractSnippet(text, [[matchStart, matchEnd]], 40);
    expect(result.text.startsWith("…")).toBe(true);
    expect(result.text.endsWith("word")).toBe(true);
  });

  it("truncates with a trailing ellipsis when the match is near the start", () => {
    const text = "word ".repeat(60).trim();
    const result = extractSnippet(text, [[0, 4]], 40);
    expect(result.text.startsWith("word")).toBe(true);
    expect(result.text.endsWith("…")).toBe(true);
  });

  it("remaps ranges into the snippet's local coordinate space", () => {
    const text = "word ".repeat(60).trim();
    const matchStart = 100;
    const matchEnd = 104;
    const result = extractSnippet(text, [[matchStart, matchEnd]], 40);
    const [localStart, localEnd] = result.ranges[0];
    expect(result.text.slice(localStart, localEnd)).toBe(
      text.slice(matchStart, matchEnd),
    );
  });

  it("keeps only ranges that fall within the extracted window", () => {
    const text = "word ".repeat(200).trim();
    const result = extractSnippet(
      text,
      [
        [0, 4],
        [900, 904],
      ],
      40,
    );
    expect(result.ranges.length).toBe(1);
  });
});

// ─── stepLocalHighlightRanges ───────────────────────────────────────────────

describe("stepLocalHighlightRanges", () => {
  it("remaps a body range fully inside the step to step-local coordinates", () => {
    expect(stepLocalHighlightRanges([10, 20], [[12, 15]])).toEqual([[2, 5]]);
  });

  it("clips a body range that only partially overlaps the step", () => {
    expect(stepLocalHighlightRanges([10, 20], [[18, 25]])).toEqual([[8, 10]]);
  });

  it("excludes ranges outside the step", () => {
    expect(
      stepLocalHighlightRanges(
        [10, 20],
        [
          [0, 5],
          [25, 30],
        ],
      ),
    ).toEqual([]);
  });
});

// ─── toSegments ─────────────────────────────────────────────────────────────

describe("toSegments", () => {
  it("returns a single unhighlighted segment when there are no ranges", () => {
    expect(toSegments("hello world", [])).toEqual([
      { text: "hello world", highlighted: false },
    ]);
  });

  it("splits text into plain/highlighted segments", () => {
    expect(toSegments("hello world", [[6, 11]])).toEqual([
      { text: "hello ", highlighted: false },
      { text: "world", highlighted: true },
    ]);
  });

  it("handles a match at the very start of the text", () => {
    expect(toSegments("hello world", [[0, 5]])).toEqual([
      { text: "hello", highlighted: true },
      { text: " world", highlighted: false },
    ]);
  });

  it("handles multiple disjoint matches", () => {
    expect(
      toSegments("one two three", [
        [0, 3],
        [8, 13],
      ]),
    ).toEqual([
      { text: "one", highlighted: true },
      { text: " two ", highlighted: false },
      { text: "three", highlighted: true },
    ]);
  });

  it("clamps overlapping ranges instead of duplicating text", () => {
    expect(
      toSegments("hello world", [
        [0, 5],
        [3, 8],
      ]),
    ).toEqual([
      { text: "hello", highlighted: true },
      { text: " wo", highlighted: true },
      { text: "rld", highlighted: false },
    ]);
  });
});
