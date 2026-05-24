import type { Exercise } from "./database";
import { FITNESS_ALIAS_MAP } from "./exerciseSearchAliases";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AliasMap = Record<string, string[]>;

export interface IndexedExercise {
  exercise: Exercise;
  normalizedName: string;
  nameTokens: string[];
  namePrefixes: Set<string>;
  expandedTokens: string[];
  expandedPrefixes: Set<string>;
}

export interface ExerciseSearchIndex {
  activePlanExercises: IndexedExercise[];
  favoriteExercises: IndexedExercise[];
  otherExercises: IndexedExercise[];
  aliasMap: AliasMap;
}

export interface SearchFilters {
  equipment: string | null;
  bodyPart: string | null;
  targetMuscle: string | null;
}

export interface SearchOptions {
  fuzzyEnabled?: boolean;
  minQueryLengthForFuzzy?: number;
  debugScores?: boolean;
}

export interface ScoreBreakdown {
  exactName: number;
  prefixName: number;
  exactToken: number;
  prefixToken: number;
  aliasBonus: number;
  fuzzyToken: number;
  coverageMultiplier: number;
}

export interface SearchResult {
  exercise: Exercise;
  score: number;
  breakdown?: { fuzzyToken: number } & Partial<ScoreBreakdown>;
}

export interface AutocompleteSuggestion {
  text: string;
  exerciseId: number;
  isAliasSuggestion: boolean;
  aliasSource?: string;
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  minQueryLength?: number;
}

// ─── Text normalization ───────────────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Levenshtein distance ─────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function maxFuzzyDistance(tokenLen: number): number {
  if (tokenLen < 3) return 0;
  if (tokenLen <= 4) return 1;
  return 2;
}

// ─── Index building ───────────────────────────────────────────────────────────

function buildPrefixes(tokens: string[]): Set<string> {
  const prefixes = new Set<string>();
  for (const token of tokens) {
    for (let i = 2; i <= token.length; i++) {
      prefixes.add(token.slice(0, i));
    }
  }
  return prefixes;
}

function indexExercise(
  exercise: Exercise,
  aliasMap: AliasMap,
): IndexedExercise {
  const normalizedName = normalizeText(exercise.name);
  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const namePrefixes = buildPrefixes(nameTokens);

  // Find alias keys whose canonical values appear in this exercise's name
  const aliasKeys: string[] = [];
  for (const [aliasKey, canonicals] of Object.entries(aliasMap)) {
    const normalizedKey = normalizeText(aliasKey);
    for (const canonical of canonicals) {
      if (normalizedName.includes(normalizeText(canonical))) {
        aliasKeys.push(normalizedKey);
        break;
      }
    }
  }

  const expandedTokens = [...nameTokens, ...aliasKeys];
  const aliasKeyTokens = aliasKeys.flatMap((k) => k.split(" ").filter(Boolean));
  const expandedPrefixes = buildPrefixes([...nameTokens, ...aliasKeyTokens]);

  return {
    exercise,
    normalizedName,
    nameTokens,
    namePrefixes,
    expandedTokens,
    expandedPrefixes,
  };
}

export function buildExerciseSearchIndex(
  exercises: {
    activePlanExercises?: Exercise[];
    favoriteExercises?: Exercise[];
    otherExercises: Exercise[];
  },
  aliasMap: AliasMap = FITNESS_ALIAS_MAP,
): ExerciseSearchIndex {
  return {
    activePlanExercises: (exercises.activePlanExercises ?? []).map((e) =>
      indexExercise(e, aliasMap),
    ),
    favoriteExercises: (exercises.favoriteExercises ?? []).map((e) =>
      indexExercise(e, aliasMap),
    ),
    otherExercises: exercises.otherExercises.map((e) =>
      indexExercise(e, aliasMap),
    ),
    aliasMap,
  };
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function passesFilters(exercise: Exercise, filters: SearchFilters): boolean {
  if (
    filters.equipment &&
    filters.equipment !== "all" &&
    exercise.equipment !== filters.equipment
  ) {
    return false;
  }
  if (
    filters.bodyPart &&
    filters.bodyPart !== "all" &&
    exercise.body_part !== filters.bodyPart
  ) {
    return false;
  }
  if (
    filters.targetMuscle &&
    filters.targetMuscle !== "all" &&
    exercise.target_muscle !== filters.targetMuscle
  ) {
    return false;
  }
  return true;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreExercise(
  indexed: IndexedExercise,
  queryTokens: string[],
  normalizedQuery: string,
  aliasMap: AliasMap,
  fuzzyEnabled: boolean,
  minQueryLengthForFuzzy: number,
  debug: boolean,
): SearchResult {
  const { exercise } = indexed;

  // Exact full-name match — perfect score, short-circuit
  if (indexed.normalizedName === normalizedQuery) {
    const breakdown = debug
      ? {
          exactName: 100,
          prefixName: 0,
          exactToken: 0,
          prefixToken: 0,
          aliasBonus: 0,
          fuzzyToken: 0,
          coverageMultiplier: 1,
        }
      : { fuzzyToken: 0 };
    return { exercise, score: 100, breakdown };
  }

  let score = 0;
  const bd: ScoreBreakdown = {
    exactName: 0,
    prefixName: 0,
    exactToken: 0,
    prefixToken: 0,
    aliasBonus: 0,
    fuzzyToken: 0,
    coverageMultiplier: 1,
  };

  // Full-name prefix match
  if (indexed.normalizedName.startsWith(normalizedQuery)) {
    score = 60;
    bd.prefixName = 60;
  }

  // Expand query tokens through alias map
  const expandedQueryTokens: string[] = [];
  let aliasHit = false;
  for (const token of queryTokens) {
    expandedQueryTokens.push(token);
    const canonicals = aliasMap[token];
    if (canonicals) {
      aliasHit = true;
      for (const canonical of canonicals) {
        const canonTokens = normalizeText(canonical).split(" ").filter(Boolean);
        expandedQueryTokens.push(...canonTokens);
      }
    }
  }

  // Per-token scoring
  let matched = 0;
  let fuzzyScore = 0;

  for (const token of expandedQueryTokens) {
    // Exact token match
    if (indexed.expandedTokens.includes(token)) {
      if (score < 80) {
        score = 80;
        bd.exactToken = 80;
      }
      matched++;
      continue;
    }
    // Prefix of a name token
    if (
      indexed.namePrefixes.has(token) ||
      indexed.expandedPrefixes.has(token)
    ) {
      if (score < 50) {
        score = 50;
        bd.prefixToken = 50;
      }
      matched++;
      continue;
    }
    // Any name token starts with this query token
    if (indexed.nameTokens.some((nt) => nt.startsWith(token))) {
      if (score < 50) {
        score = 50;
        bd.prefixToken = 50;
      }
      matched++;
      continue;
    }
    // Fuzzy fallback
    if (fuzzyEnabled && token.length >= minQueryLengthForFuzzy) {
      const maxDist = maxFuzzyDistance(token.length);
      if (maxDist > 0) {
        let bestDist = Infinity;
        for (const nt of indexed.nameTokens) {
          const dist = levenshtein(token, nt);
          if (dist < bestDist) bestDist = dist;
        }
        if (bestDist <= maxDist) {
          const fScore = bestDist === 1 ? 20 : 10;
          if (fScore > fuzzyScore) fuzzyScore = fScore;
          matched++;
        }
      }
    }
  }

  if (fuzzyScore > 0 && score < fuzzyScore) {
    score = fuzzyScore;
    bd.fuzzyToken = fuzzyScore;
  }

  // Coverage multiplier
  const coverage =
    expandedQueryTokens.length > 0 ? matched / expandedQueryTokens.length : 0;
  bd.coverageMultiplier = coverage;

  if (score < 100 && coverage < 1) {
    score = Math.floor(score * coverage);
  }

  // Alias bonus
  if (aliasHit && matched > 0) {
    score = Math.min(100, score + 10);
    bd.aliasBonus = 10;
  }

  return {
    exercise,
    score,
    breakdown: debug ? bd : { fuzzyToken: bd.fuzzyToken },
  };
}

// ─── Search ───────────────────────────────────────────────────────────────────

type BucketedResults = {
  activePlanExercises: SearchResult[];
  favoriteExercises: SearchResult[];
  otherExercises: SearchResult[];
};

function searchBucket(
  bucket: IndexedExercise[],
  normalizedQuery: string,
  queryTokens: string[],
  filters: SearchFilters,
  aliasMap: AliasMap,
  fuzzyEnabled: boolean,
  minQueryLengthForFuzzy: number,
  debug: boolean,
  topNonFuzzyScore: { value: number },
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const indexed of bucket) {
    if (!passesFilters(indexed.exercise, filters)) continue;
    if (!normalizedQuery) {
      results.push({ exercise: indexed.exercise, score: 0 });
      continue;
    }
    const result = scoreExercise(
      indexed,
      queryTokens,
      normalizedQuery,
      aliasMap,
      fuzzyEnabled,
      minQueryLengthForFuzzy,
      debug,
    );
    if (result.score > 0) results.push(result);
    if (
      result.score > topNonFuzzyScore.value &&
      (result.breakdown?.fuzzyToken ?? 0) === 0
    ) {
      topNonFuzzyScore.value = result.score;
    }
  }
  return results;
}

export function searchExercises(
  index: ExerciseSearchIndex,
  query: string,
  filters: SearchFilters,
  options: SearchOptions = {},
): BucketedResults {
  const {
    fuzzyEnabled = true,
    minQueryLengthForFuzzy = 3,
    debugScores = false,
  } = options;

  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);

  const topNonFuzzyScore = { value: 0 };

  const scoreAndSort = (bucket: IndexedExercise[]): SearchResult[] => {
    const results = searchBucket(
      bucket,
      normalizedQuery,
      queryTokens,
      filters,
      index.aliasMap,
      fuzzyEnabled,
      minQueryLengthForFuzzy,
      debugScores,
      topNonFuzzyScore,
    );
    if (!normalizedQuery) return results;
    return results.sort((a, b) => b.score - a.score);
  };

  const activePlanExercises = scoreAndSort(index.activePlanExercises);
  const favoriteExercises = scoreAndSort(index.favoriteExercises);
  const otherExercises = scoreAndSort(index.otherExercises);

  // Filter fuzzy-only results that score too far below the top non-fuzzy result
  if (fuzzyEnabled && topNonFuzzyScore.value > 0) {
    const fuzzyThreshold = topNonFuzzyScore.value - 15;
    const filterFuzzyNoise = (r: SearchResult) =>
      r.score >= fuzzyThreshold || (r.breakdown?.fuzzyToken ?? 0) === 0;
    return {
      activePlanExercises: activePlanExercises.filter(filterFuzzyNoise),
      favoriteExercises: favoriteExercises.filter(filterFuzzyNoise),
      otherExercises: otherExercises.filter(filterFuzzyNoise),
    };
  }

  return { activePlanExercises, favoriteExercises, otherExercises };
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export function getExerciseSuggestions(
  index: ExerciseSearchIndex,
  query: string,
  options: SuggestionOptions = {},
): AutocompleteSuggestion[] {
  const { maxSuggestions = 5, minQueryLength = 3 } = options;

  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < minQueryLength) return [];

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const lastToken = queryTokens[queryTokens.length - 1] ?? "";

  const seen = new Set<number>();
  const suggestions: AutocompleteSuggestion[] = [];

  // Detect if the last query token is a prefix of an alias key
  let aliasSource: string | undefined;
  for (const aliasKey of Object.keys(index.aliasMap)) {
    const normalizedKey = normalizeText(aliasKey);
    if (normalizedKey.startsWith(lastToken) && normalizedKey !== lastToken) {
      aliasSource = aliasKey;
      break;
    }
  }

  const allBuckets = [
    ...index.activePlanExercises,
    ...index.favoriteExercises,
    ...index.otherExercises,
  ];

  // Score all exercises for prefix/alias matching
  const scored: { indexed: IndexedExercise; score: number }[] = [];
  for (const indexed of allBuckets) {
    if (seen.has(indexed.exercise.exercise_id)) continue;
    // Only prefix-based matching for suggestions
    let score = 0;
    if (indexed.normalizedName.startsWith(normalizedQuery)) score = 60;
    else if (indexed.nameTokens.some((t) => t.startsWith(lastToken)))
      score = 40;
    else if (indexed.expandedPrefixes.has(lastToken)) score = 30;
    if (score > 0) scored.push({ indexed, score });
  }

  scored.sort((a, b) => b.score - a.score);

  for (const { indexed } of scored) {
    if (suggestions.length >= maxSuggestions) break;
    const id = indexed.exercise.exercise_id;
    if (seen.has(id)) continue;
    seen.add(id);
    suggestions.push({
      text: indexed.exercise.name,
      exerciseId: id,
      isAliasSuggestion: aliasSource !== undefined,
      aliasSource,
    });
  }

  return suggestions;
}
