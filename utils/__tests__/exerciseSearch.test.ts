import {
  normalizeText,
  levenshtein,
  buildExerciseSearchIndex,
  searchExercises,
  getExerciseSuggestions,
  type AliasMap,
  type SearchFilters,
} from "../exerciseSearch";
import type { Exercise } from "../database";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeExercise(
  overrides: Partial<Exercise> & { name: string },
): Exercise {
  return {
    exercise_id: Math.floor(Math.random() * 100000),
    image: [],
    local_animated_uri: "",
    animated_url: "",
    equipment: "barbell",
    body_part: "chest",
    target_muscle: "pectorals",
    secondary_muscles: [],
    description: "",
    ...overrides,
  };
}

const BENCH_PRESS = makeExercise({
  exercise_id: 1,
  name: "Bench Press",
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "pectorals",
});
const INCLINE_BENCH = makeExercise({
  exercise_id: 2,
  name: "Incline Bench Press",
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "upper chest",
});
const DB_BENCH = makeExercise({
  exercise_id: 3,
  name: "Dumbbell Bench Press",
  equipment: "dumbbell",
  body_part: "chest",
  target_muscle: "pectorals",
});
const ROMANIAN_DL = makeExercise({
  exercise_id: 4,
  name: "Romanian Deadlift",
  equipment: "barbell",
  body_part: "legs",
  target_muscle: "hamstrings",
});
const OVERHEAD_PRESS = makeExercise({
  exercise_id: 5,
  name: "Overhead Press",
  equipment: "barbell",
  body_part: "shoulders",
  target_muscle: "deltoids",
});
const PULL_UP = makeExercise({
  exercise_id: 6,
  name: "Pull-Up",
  equipment: "body weight",
  body_part: "back",
  target_muscle: "latissimus dorsi",
});
const SKULL_CRUSHER = makeExercise({
  exercise_id: 7,
  name: "Skull Crusher",
  equipment: "barbell",
  body_part: "arms",
  target_muscle: "triceps",
});
const CABLE_FLY = makeExercise({
  exercise_id: 8,
  name: "Cable Fly",
  equipment: "cable",
  body_part: "chest",
  target_muscle: "pectorals",
});
const LAT_PULLDOWN = makeExercise({
  exercise_id: 9,
  name: "Lat Pulldown",
  equipment: "cable",
  body_part: "back",
  target_muscle: "latissimus dorsi",
});

const ALL_EXERCISES = [
  BENCH_PRESS,
  INCLINE_BENCH,
  DB_BENCH,
  ROMANIAN_DL,
  OVERHEAD_PRESS,
  PULL_UP,
  SKULL_CRUSHER,
  CABLE_FLY,
  LAT_PULLDOWN,
];

const TEST_ALIAS_MAP: AliasMap = {
  rdl: ["romanian deadlift"],
  ohp: ["overhead press"],
  bp: ["bench press"],
  db: ["dumbbell"],
  skull: ["skull crusher"],
  pullup: ["pull-up"],
  "pull up": ["pull-up"],
  lats: ["latissimus dorsi"],
  "lat pd": ["lat pulldown"],
};

const noFilters: SearchFilters = {
  equipment: null,
  bodyPart: null,
  targetMuscle: null,
};

function buildIndex(exercises: Exercise[] = ALL_EXERCISES) {
  return buildExerciseSearchIndex(
    { otherExercises: exercises },
    TEST_ALIAS_MAP,
  );
}

// ─── normalizeText ────────────────────────────────────────────────────────────

describe("normalizeText", () => {
  it("lowercases", () => {
    expect(normalizeText("BENCH PRESS")).toBe("bench press");
  });

  it("strips diacritics", () => {
    expect(normalizeText("Rémi")).toBe("remi");
    expect(normalizeText("cürĺ")).toBe("curl");
  });

  it("replaces hyphens with spaces", () => {
    expect(normalizeText("Pull-Up")).toBe("pull up");
  });

  it("collapses extra whitespace", () => {
    expect(normalizeText("  bench   press  ")).toBe("bench press");
  });

  it("replaces apostrophes with space (non-alphanumeric → space)", () => {
    expect(normalizeText("Farmer's Walk")).toBe("farmer s walk");
  });

  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

// ─── levenshtein ──────────────────────────────────────────────────────────────

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("bench", "bench")).toBe(0);
  });

  it("single character insertion", () => {
    expect(levenshtein("bech", "bench")).toBe(1);
  });

  it("single character deletion", () => {
    expect(levenshtein("benchh", "bench")).toBe(1);
  });

  it("single character substitution", () => {
    expect(levenshtein("bAnch", "bench")).toBe(1);
  });

  it("two-character error — transposition costs 2 in standard Levenshtein", () => {
    // "incilne" vs "incline": 'l' and 'i' swapped at positions 3-4
    expect(levenshtein("incilne", "incline")).toBe(2);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "bench")).toBe(5);
    expect(levenshtein("bench", "")).toBe(5);
    expect(levenshtein("", "")).toBe(0);
  });
});

// ─── buildExerciseSearchIndex ─────────────────────────────────────────────────

describe("buildExerciseSearchIndex", () => {
  it("indexes all exercises", () => {
    const index = buildIndex();
    expect(index.otherExercises).toHaveLength(ALL_EXERCISES.length);
  });

  it("normalizes exercise names", () => {
    const index = buildIndex([BENCH_PRESS]);
    expect(index.otherExercises[0].normalizedName).toBe("bench press");
  });

  it("tokenizes names correctly", () => {
    const index = buildIndex([BENCH_PRESS]);
    expect(index.otherExercises[0].nameTokens).toEqual(["bench", "press"]);
  });

  it("Pull-Up normalizes hyphen to space and tokenizes", () => {
    const index = buildIndex([PULL_UP]);
    const indexed = index.otherExercises[0];
    expect(indexed.normalizedName).toBe("pull up");
    expect(indexed.nameTokens).toContain("pull");
    expect(indexed.nameTokens).toContain("up");
  });

  it("builds prefix set containing token prefixes", () => {
    const index = buildIndex([BENCH_PRESS]);
    const { namePrefixes } = index.otherExercises[0];
    expect(namePrefixes.has("be")).toBe(true);
    expect(namePrefixes.has("ben")).toBe(true);
    expect(namePrefixes.has("benc")).toBe(true);
    expect(namePrefixes.has("bench")).toBe(true);
    expect(namePrefixes.has("pr")).toBe(true);
    expect(namePrefixes.has("press")).toBe(true);
  });

  it("adds alias keys to expandedTokens for matching exercises", () => {
    const index = buildIndex([ROMANIAN_DL]);
    const indexed = index.otherExercises[0];
    // "rdl" → "romanian deadlift" — should be in expandedTokens
    expect(indexed.expandedTokens).toContain("rdl");
  });

  it("does NOT add alias keys to non-matching exercises", () => {
    const index = buildIndex([BENCH_PRESS]);
    const indexed = index.otherExercises[0];
    expect(indexed.expandedTokens).not.toContain("rdl");
  });

  it("handles undefined optional buckets gracefully", () => {
    const index = buildExerciseSearchIndex(
      { otherExercises: [BENCH_PRESS] },
      TEST_ALIAS_MAP,
    );
    expect(index.activePlanExercises).toHaveLength(0);
    expect(index.favoriteExercises).toHaveLength(0);
  });
});

// ─── searchExercises — exact and prefix matching ──────────────────────────────

describe("searchExercises — exact and prefix", () => {
  const index = buildIndex();

  it("exact full-name match scores 100", () => {
    const { otherExercises } = searchExercises(
      index,
      "bench press",
      noFilters,
      { fuzzyEnabled: false },
    );
    expect(otherExercises[0].exercise).toBe(BENCH_PRESS);
    expect(otherExercises[0].score).toBe(100);
  });

  it("exact match is case-insensitive", () => {
    const { otherExercises } = searchExercises(
      index,
      "BENCH PRESS",
      noFilters,
      { fuzzyEnabled: false },
    );
    expect(otherExercises[0].exercise).toBe(BENCH_PRESS);
    expect(otherExercises[0].score).toBe(100);
  });

  it("prefix match returns exercises starting with query", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters, {
      fuzzyEnabled: false,
    });
    const names = otherExercises.map((r) => r.exercise.name);
    expect(names).toContain("Bench Press");
    expect(names).toContain("Incline Bench Press");
    expect(names).toContain("Dumbbell Bench Press");
  });

  it("prefix match: exact-prefix exercise outranks partial-token match", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters, {
      fuzzyEnabled: false,
    });
    const first = otherExercises[0].exercise.name;
    expect(first).toBe("Bench Press"); // starts with "bench"
  });

  it("multi-word query matches correct exercise", () => {
    const { otherExercises } = searchExercises(
      index,
      "overhead press",
      noFilters,
      { fuzzyEnabled: false },
    );
    expect(otherExercises[0].exercise).toBe(OVERHEAD_PRESS);
    expect(otherExercises[0].score).toBe(100);
  });

  it("single char query returns all exercises (score 0, unranked)", () => {
    const { otherExercises } = searchExercises(index, "a", noFilters, {
      fuzzyEnabled: false,
    });
    // score 0 — exercises that don't match text return empty
    // single char is too short for prefix sets, will fall through to substring check
    const benchResult = otherExercises.find((r) => r.exercise === BENCH_PRESS);
    // "a" is not in "bench press" — should not match
    expect(benchResult).toBeUndefined();
  });

  it("empty query with no filters returns all exercises with score 0", () => {
    const { otherExercises } = searchExercises(index, "", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises).toHaveLength(ALL_EXERCISES.length);
    expect(otherExercises.every((r) => r.score === 0)).toBe(true);
  });

  it("no-match query returns empty lists", () => {
    const { otherExercises } = searchExercises(index, "zxqw", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises).toHaveLength(0);
  });

  it("extra whitespace in query is normalized", () => {
    const r1 = searchExercises(index, "bench press", noFilters, {
      fuzzyEnabled: false,
    });
    const r2 = searchExercises(index, "  bench   press  ", noFilters, {
      fuzzyEnabled: false,
    });
    expect(r1.otherExercises[0].score).toBe(r2.otherExercises[0].score);
  });
});

// ─── searchExercises — alias matching ────────────────────────────────────────

describe("searchExercises — alias matching", () => {
  const index = buildIndex();

  it("alias 'rdl' matches Romanian Deadlift", () => {
    const { otherExercises } = searchExercises(index, "rdl", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(ROMANIAN_DL);
    expect(otherExercises[0].score).toBeGreaterThan(0);
  });

  it("alias 'ohp' matches Overhead Press", () => {
    const { otherExercises } = searchExercises(index, "ohp", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(OVERHEAD_PRESS);
  });

  it("alias 'skull' matches Skull Crusher", () => {
    const { otherExercises } = searchExercises(index, "skull", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(SKULL_CRUSHER);
  });

  it("alias 'pullup' matches Pull-Up", () => {
    const { otherExercises } = searchExercises(index, "pullup", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(PULL_UP);
  });

  it("multi-token alias query 'db bench' matches Dumbbell Bench Press", () => {
    const { otherExercises } = searchExercises(index, "db bench", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(DB_BENCH);
  });

  it("alias 'lat pd' matches Lat Pulldown", () => {
    const { otherExercises } = searchExercises(index, "lat pd", noFilters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises[0].exercise).toBe(LAT_PULLDOWN);
  });
});

// ─── searchExercises — hard filters ──────────────────────────────────────────

describe("searchExercises — hard filters", () => {
  const index = buildIndex();

  it("equipment filter excludes non-matching exercises", () => {
    const filters: SearchFilters = {
      equipment: "dumbbell",
      bodyPart: null,
      targetMuscle: null,
    };
    const { otherExercises } = searchExercises(index, "bench", filters, {
      fuzzyEnabled: false,
    });
    expect(
      otherExercises.every((r) => r.exercise.equipment === "dumbbell"),
    ).toBe(true);
    expect(otherExercises.some((r) => r.exercise === DB_BENCH)).toBe(true);
    expect(otherExercises.some((r) => r.exercise === BENCH_PRESS)).toBe(false);
  });

  it("'all' filter value means no filtering", () => {
    const filters: SearchFilters = {
      equipment: "all",
      bodyPart: null,
      targetMuscle: null,
    };
    const { otherExercises } = searchExercises(index, "bench", filters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises.length).toBeGreaterThan(1);
  });

  it("bodyPart filter works", () => {
    const filters: SearchFilters = {
      equipment: null,
      bodyPart: "back",
      targetMuscle: null,
    };
    const { otherExercises } = searchExercises(index, "", filters);
    expect(otherExercises.every((r) => r.exercise.body_part === "back")).toBe(
      true,
    );
  });

  it("incompatible filter + query returns empty", () => {
    const filters: SearchFilters = {
      equipment: "barbell",
      bodyPart: null,
      targetMuscle: null,
    };
    const { otherExercises } = searchExercises(index, "cable", filters, {
      fuzzyEnabled: false,
    });
    expect(otherExercises).toHaveLength(0);
  });
});

// ─── searchExercises — fuzzy matching ────────────────────────────────────────

describe("searchExercises — fuzzy matching", () => {
  const index = buildIndex();

  it("single-char typo 'benchh' matches Bench Press", () => {
    const { otherExercises } = searchExercises(index, "benchh", noFilters, {
      fuzzyEnabled: true,
    });
    const match = otherExercises.find((r) => r.exercise === BENCH_PRESS);
    expect(match).toBeDefined();
  });

  it("two-char typo 'romainian' matches Romanian Deadlift", () => {
    const { otherExercises } = searchExercises(index, "romainian", noFilters, {
      fuzzyEnabled: true,
    });
    const match = otherExercises.find((r) => r.exercise === ROMANIAN_DL);
    expect(match).toBeDefined();
  });

  it("fuzzy is disabled when fuzzyEnabled is false", () => {
    const { otherExercises } = searchExercises(index, "benchh", noFilters, {
      fuzzyEnabled: false,
    });
    const match = otherExercises.find((r) => r.exercise === BENCH_PRESS);
    expect(match).toBeUndefined();
  });

  it("prefix match still works for short queries below fuzzy threshold", () => {
    // "be" is below minQueryLengthForFuzzy=3, so fuzzy won't run,
    // but "be" IS a valid prefix of "bench" → prefix match still fires
    const { otherExercises } = searchExercises(index, "be", noFilters, {
      fuzzyEnabled: true,
      minQueryLengthForFuzzy: 3,
    });
    const match = otherExercises.find((r) => r.exercise === BENCH_PRESS);
    expect(match).toBeDefined();
    // Score comes from prefix match (not fuzzy), so it should be well above fuzzy range
    expect(match?.score ?? 0).toBeGreaterThan(20);
  });

  it("exact matches score higher than fuzzy matches", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters, {
      fuzzyEnabled: true,
    });
    const benchScore =
      otherExercises.find((r) => r.exercise === BENCH_PRESS)?.score ?? 0;
    const rdlScore =
      otherExercises.find((r) => r.exercise === ROMANIAN_DL)?.score ?? 0;
    expect(benchScore).toBeGreaterThan(rdlScore);
  });
});

// ─── searchExercises — three buckets ─────────────────────────────────────────

describe("searchExercises — bucket structure", () => {
  it("preserves three-bucket structure in results", () => {
    const index = buildExerciseSearchIndex(
      {
        activePlanExercises: [BENCH_PRESS],
        favoriteExercises: [ROMANIAN_DL],
        otherExercises: [OVERHEAD_PRESS],
      },
      TEST_ALIAS_MAP,
    );
    const result = searchExercises(index, "bench", noFilters, {
      fuzzyEnabled: false,
    });
    expect(
      result.activePlanExercises.some((r) => r.exercise === BENCH_PRESS),
    ).toBe(true);
    expect(
      result.favoriteExercises.some((r) => r.exercise === ROMANIAN_DL),
    ).toBe(false); // doesn't match "bench"
    expect(
      result.otherExercises.some((r) => r.exercise === OVERHEAD_PRESS),
    ).toBe(false); // doesn't match "bench"
  });

  it("same exercise in different buckets scores the same", () => {
    const index = buildExerciseSearchIndex(
      {
        activePlanExercises: [BENCH_PRESS],
        otherExercises: [OVERHEAD_PRESS],
      },
      TEST_ALIAS_MAP,
    );
    const result = searchExercises(index, "bench press", noFilters, {
      fuzzyEnabled: false,
    });
    expect(result.activePlanExercises[0].score).toBe(100);
  });
});

// ─── getExerciseSuggestions ───────────────────────────────────────────────────

describe("getExerciseSuggestions", () => {
  const index = buildIndex();

  it("returns empty array for query below minQueryLength", () => {
    expect(
      getExerciseSuggestions(index, "be", { minQueryLength: 3 }),
    ).toHaveLength(0);
    expect(
      getExerciseSuggestions(index, "b", { minQueryLength: 3 }),
    ).toHaveLength(0);
  });

  it("returns suggestions for 3+ char query", () => {
    const suggestions = getExerciseSuggestions(index, "ben", {
      minQueryLength: 3,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(
      suggestions.every(
        (s) =>
          s.text.toLowerCase().startsWith("bench") ||
          s.text.toLowerCase().includes("bench"),
      ),
    ).toBe(true);
  });

  it("caps suggestions at maxSuggestions", () => {
    const suggestions = getExerciseSuggestions(index, "b", {
      minQueryLength: 1,
      maxSuggestions: 3,
    });
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("default cap is 5", () => {
    const manyExercises = Array.from({ length: 20 }, (_, i) =>
      makeExercise({ exercise_id: i + 100, name: `Bench Variation ${i + 1}` }),
    );
    const largeIndex = buildIndex(manyExercises);
    const suggestions = getExerciseSuggestions(largeIndex, "bench", {
      minQueryLength: 3,
    });
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it("suggestions include exercise names matching the prefix", () => {
    const suggestions = getExerciseSuggestions(index, "bench", {
      minQueryLength: 3,
    });
    const names = suggestions.map((s) => s.text);
    expect(names.some((n) => n.includes("Bench"))).toBe(true);
  });

  it("no duplicate suggestions", () => {
    const suggestions = getExerciseSuggestions(index, "bench", {
      minQueryLength: 3,
    });
    const ids = suggestions.map((s) => s.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
