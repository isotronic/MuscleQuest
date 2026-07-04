import Fuse from "fuse.js";
import {
  normalizeText,
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
const PLANK = makeExercise({
  exercise_id: 10,
  name: "Plank",
  equipment: "body weight",
  body_part: "core",
  target_muscle: "abdominals",
  tracking_type: "time",
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
  PLANK,
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

  it("builds expandedPrefixes containing name token prefixes", () => {
    const index = buildIndex([BENCH_PRESS]);
    const { expandedPrefixes } = index.otherExercises[0];
    expect(expandedPrefixes.has("be")).toBe(true);
    expect(expandedPrefixes.has("bench")).toBe(true);
    expect(expandedPrefixes.has("pr")).toBe(true);
    expect(expandedPrefixes.has("press")).toBe(true);
  });

  it("searchText includes the normalized name", () => {
    const index = buildIndex([BENCH_PRESS]);
    expect(index.otherExercises[0].searchText).toContain("bench press");
  });

  it("adds single-word alias keys to searchText for matching exercises", () => {
    const index = buildIndex([ROMANIAN_DL]);
    // "rdl" → "romanian deadlift" — should be tagged onto the exercise
    expect(index.otherExercises[0].searchText).toContain("rdl");
  });

  it("splits multi-word alias keys into individual searchText tokens", () => {
    const index = buildIndex([LAT_PULLDOWN]);
    // alias key "lat pd" → "lat pulldown" — should contribute "lat" and "pd"
    // as independent tokens, not the literal two-word string "lat pd"
    const { searchText } = index.otherExercises[0];
    const tokens = searchText.split(" ");
    expect(tokens).toContain("pd");
  });

  it("does NOT add alias keys to non-matching exercises", () => {
    const index = buildIndex([BENCH_PRESS]);
    expect(index.otherExercises[0].searchText).not.toContain("rdl");
  });

  it("expandedPrefixes includes alias-token prefixes", () => {
    const index = buildIndex([ROMANIAN_DL]);
    expect(index.otherExercises[0].expandedPrefixes.has("rd")).toBe(true);
  });

  it("handles undefined optional buckets gracefully", () => {
    const index = buildExerciseSearchIndex(
      { otherExercises: [BENCH_PRESS] },
      TEST_ALIAS_MAP,
    );
    expect(index.activePlanExercises).toHaveLength(0);
    expect(index.favoriteExercises).toHaveLength(0);
  });

  it("builds a Fuse instance per bucket", () => {
    const index = buildExerciseSearchIndex(
      {
        activePlanExercises: [BENCH_PRESS],
        favoriteExercises: [ROMANIAN_DL],
        otherExercises: [OVERHEAD_PRESS],
      },
      TEST_ALIAS_MAP,
    );
    expect(index.activePlanFuse).toBeInstanceOf(Fuse);
    expect(index.favoriteFuse).toBeInstanceOf(Fuse);
    expect(index.otherFuse).toBeInstanceOf(Fuse);
  });
});

// ─── searchExercises — exact and prefix matching ──────────────────────────────

describe("searchExercises — exact and prefix", () => {
  const index = buildIndex();

  it("exact full-name match ranks first", () => {
    const { otherExercises } = searchExercises(index, "bench press", noFilters);
    expect(otherExercises[0].exercise).toBe(BENCH_PRESS);
  });

  it("exact match is case-insensitive", () => {
    const { otherExercises } = searchExercises(index, "BENCH PRESS", noFilters);
    expect(otherExercises[0].exercise).toBe(BENCH_PRESS);
  });

  it("prefix match returns exercises starting with query", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters);
    const names = otherExercises.map((r) => r.exercise.name);
    expect(names).toContain("Bench Press");
    expect(names).toContain("Incline Bench Press");
    expect(names).toContain("Dumbbell Bench Press");
  });

  it("prefix match: exact-prefix exercise outranks partial-token match", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters);
    expect(otherExercises[0].exercise.name).toBe("Bench Press");
  });

  it("multi-word query matches correct exercise regardless of order", () => {
    const forward = searchExercises(index, "overhead press", noFilters);
    const reversed = searchExercises(index, "press overhead", noFilters);
    expect(forward.otherExercises[0].exercise).toBe(OVERHEAD_PRESS);
    expect(reversed.otherExercises[0].exercise).toBe(OVERHEAD_PRESS);
  });

  it("query containing Fuse extended-search operator characters is treated as literal text", () => {
    // "|" is Fuse's OR operator and "=" is its exact-match operator in
    // extended-search syntax: normalizeText must strip both before the
    // query reaches Fuse, or this would be misinterpreted as an operator
    // rather than matched as literal (stripped-to-space) text.
    const withOperators = searchExercises(index, "bench | press", noFilters);
    const withoutOperators = searchExercises(index, "bench press", noFilters);
    expect(withOperators.otherExercises[0].exercise).toBe(
      withoutOperators.otherExercises[0].exercise,
    );
  });

  it("empty query with no filters returns all exercises with score 0", () => {
    const { otherExercises } = searchExercises(index, "", noFilters);
    expect(otherExercises).toHaveLength(ALL_EXERCISES.length);
    expect(otherExercises.every((r) => r.score === 0)).toBe(true);
  });

  it("no-match query returns empty lists", () => {
    const { otherExercises } = searchExercises(index, "zxqwzxqw", noFilters);
    expect(otherExercises).toHaveLength(0);
  });

  it("extra whitespace in query does not change the top result", () => {
    const r1 = searchExercises(index, "bench press", noFilters);
    const r2 = searchExercises(index, "  bench   press  ", noFilters);
    expect(r1.otherExercises[0].exercise).toBe(r2.otherExercises[0].exercise);
  });
});

// ─── searchExercises — alias matching ────────────────────────────────────────

describe("searchExercises — alias matching", () => {
  const index = buildIndex();

  it("alias 'rdl' matches Romanian Deadlift", () => {
    const { otherExercises } = searchExercises(index, "rdl", noFilters);
    expect(otherExercises[0].exercise).toBe(ROMANIAN_DL);
  });

  it("alias 'ohp' matches Overhead Press", () => {
    const { otherExercises } = searchExercises(index, "ohp", noFilters);
    expect(otherExercises[0].exercise).toBe(OVERHEAD_PRESS);
  });

  it("alias 'skull' matches Skull Crusher", () => {
    const { otherExercises } = searchExercises(index, "skull", noFilters);
    expect(otherExercises[0].exercise).toBe(SKULL_CRUSHER);
  });

  it("alias 'pullup' matches Pull-Up", () => {
    const { otherExercises } = searchExercises(index, "pullup", noFilters);
    expect(otherExercises[0].exercise).toBe(PULL_UP);
  });

  it("multi-token alias query 'db bench' matches Dumbbell Bench Press", () => {
    const { otherExercises } = searchExercises(index, "db bench", noFilters);
    expect(otherExercises[0].exercise).toBe(DB_BENCH);
  });

  it("alias 'lat pd' matches Lat Pulldown", () => {
    const { otherExercises } = searchExercises(index, "lat pd", noFilters);
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
    const { otherExercises } = searchExercises(index, "bench", filters);
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
    const { otherExercises } = searchExercises(index, "bench", filters);
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
    const { otherExercises } = searchExercises(index, "cable", filters);
    expect(otherExercises).toHaveLength(0);
  });

  it("trackingType filter excludes exercises of a different tracking type", () => {
    const filters: SearchFilters = {
      equipment: null,
      bodyPart: null,
      targetMuscle: null,
      trackingType: "time",
    };
    const { otherExercises } = searchExercises(index, "", filters);
    expect(otherExercises.length).toBeGreaterThan(0);
    expect(
      otherExercises.every((r) => r.exercise.tracking_type === "time"),
    ).toBe(true);
  });
});

// ─── searchExercises — fuzzy matching ────────────────────────────────────────

describe("searchExercises — fuzzy matching", () => {
  const index = buildIndex();

  it("single-char typo 'benchh' matches Bench Press", () => {
    const { otherExercises } = searchExercises(index, "benchh", noFilters);
    expect(otherExercises.some((r) => r.exercise === BENCH_PRESS)).toBe(true);
  });

  it("two-char typo 'romainian' matches Romanian Deadlift", () => {
    const { otherExercises } = searchExercises(index, "romainian", noFilters);
    expect(otherExercises.some((r) => r.exercise === ROMANIAN_DL)).toBe(true);
  });

  it("exact match ranks above a typo’d match of a different exercise", () => {
    const { otherExercises } = searchExercises(index, "bench", noFilters);
    const benchIdx = otherExercises.findIndex((r) => r.exercise === BENCH_PRESS);
    const rdlIdx = otherExercises.findIndex((r) => r.exercise === ROMANIAN_DL);
    // Romanian Deadlift shouldn't match "bench" at all
    expect(rdlIdx).toBe(-1);
    expect(benchIdx).toBeGreaterThanOrEqual(0);
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
    const result = searchExercises(index, "bench", noFilters);
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

  it("same exercise in different buckets matches the same way", () => {
    const index = buildExerciseSearchIndex(
      {
        activePlanExercises: [BENCH_PRESS],
        otherExercises: [OVERHEAD_PRESS],
      },
      TEST_ALIAS_MAP,
    );
    const result = searchExercises(index, "bench press", noFilters);
    expect(result.activePlanExercises[0].exercise).toBe(BENCH_PRESS);
    expect(result.activePlanExercises[0].score).toBeLessThan(0.1);
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

  it("suggests exercises whose alias tokens match the prefix", () => {
    // "rd" is a prefix of the "rdl" alias token tagged onto Romanian Deadlift
    const suggestions = getExerciseSuggestions(index, "rd", {
      minQueryLength: 2,
    });
    expect(
      suggestions.some((s) => s.exerciseId === ROMANIAN_DL.exercise_id),
    ).toBe(true);
  });
});
