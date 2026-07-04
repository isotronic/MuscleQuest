import Fuse, { type IFuseOptions } from "fuse.js";
import type { Exercise } from "./database";
import { FITNESS_ALIAS_MAP } from "./exerciseSearchAliases";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AliasMap = Record<string, string[]>;

export interface IndexedExercise {
  exercise: Exercise;
  normalizedName: string;
  nameTokens: string[];
  expandedPrefixes: Set<string>;
  searchText: string;
}

export interface ExerciseSearchIndex {
  activePlanExercises: IndexedExercise[];
  favoriteExercises: IndexedExercise[];
  otherExercises: IndexedExercise[];
  activePlanFuse: Fuse<IndexedExercise>;
  favoriteFuse: Fuse<IndexedExercise>;
  otherFuse: Fuse<IndexedExercise>;
  aliasMap: AliasMap;
}

export interface SearchFilters {
  equipment: string | null;
  bodyPart: string | null;
  targetMuscle: string | null;
  trackingType?: string | null;
}

export interface SearchResult {
  exercise: Exercise;
  score: number;
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

const FUSE_OPTIONS: IFuseOptions<IndexedExercise> = {
  keys: ["searchText"],
  useExtendedSearch: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 2,
  includeScore: true,
};

function indexExercise(
  exercise: Exercise,
  aliasMap: AliasMap,
): IndexedExercise {
  const normalizedName = normalizeText(exercise.name);
  const nameTokens = normalizedName.split(" ").filter(Boolean);

  // Find alias keys whose canonical values appear in this exercise's name,
  // and collect each key's own words — a multi-word key like "lat pd"
  // contributes "lat" and "pd" as independent searchable tokens, not the
  // literal two-word string, so extended-search AND matching finds both.
  const aliasTokenSet = new Set<string>();
  for (const [aliasKey, canonicals] of Object.entries(aliasMap)) {
    for (const canonical of canonicals) {
      if (normalizedName.includes(normalizeText(canonical))) {
        for (const token of normalizeText(aliasKey).split(" ").filter(Boolean)) {
          aliasTokenSet.add(token);
        }
        break;
      }
    }
  }

  const aliasTokens = [...aliasTokenSet];
  const expandedPrefixes = buildPrefixes([...nameTokens, ...aliasTokens]);
  const searchText = [normalizedName, ...aliasTokens].join(" ");

  return { exercise, normalizedName, nameTokens, expandedPrefixes, searchText };
}

function buildFuse(bucket: IndexedExercise[]): Fuse<IndexedExercise> {
  return new Fuse(bucket, FUSE_OPTIONS);
}

export function buildExerciseSearchIndex(
  exercises: {
    activePlanExercises?: Exercise[];
    favoriteExercises?: Exercise[];
    otherExercises: Exercise[];
  },
  aliasMap: AliasMap = FITNESS_ALIAS_MAP,
): ExerciseSearchIndex {
  const activePlanExercises = (exercises.activePlanExercises ?? []).map((e) =>
    indexExercise(e, aliasMap),
  );
  const favoriteExercises = (exercises.favoriteExercises ?? []).map((e) =>
    indexExercise(e, aliasMap),
  );
  const otherExercises = exercises.otherExercises.map((e) =>
    indexExercise(e, aliasMap),
  );

  return {
    activePlanExercises,
    favoriteExercises,
    otherExercises,
    activePlanFuse: buildFuse(activePlanExercises),
    favoriteFuse: buildFuse(favoriteExercises),
    otherFuse: buildFuse(otherExercises),
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
  if (
    filters.trackingType &&
    filters.trackingType !== "all" &&
    (exercise.tracking_type ?? "weight") !== filters.trackingType
  ) {
    return false;
  }
  return true;
}

// ─── Search ───────────────────────────────────────────────────────────────────

type BucketedResults = {
  activePlanExercises: SearchResult[];
  favoriteExercises: SearchResult[];
  otherExercises: SearchResult[];
};

function searchBucket(
  bucket: IndexedExercise[],
  fuse: Fuse<IndexedExercise>,
  normalizedQuery: string,
  filters: SearchFilters,
): SearchResult[] {
  if (!normalizedQuery) {
    return bucket
      .filter((indexed) => passesFilters(indexed.exercise, filters))
      .map((indexed) => ({ exercise: indexed.exercise, score: 0 }));
  }
  return fuse
    .search(normalizedQuery)
    .filter((result) => passesFilters(result.item.exercise, filters))
    .map((result) => ({
      exercise: result.item.exercise,
      score: result.score ?? 0,
    }));
}

export function searchExercises(
  index: ExerciseSearchIndex,
  query: string,
  filters: SearchFilters,
): BucketedResults {
  const normalizedQuery = normalizeText(query);
  return {
    activePlanExercises: searchBucket(
      index.activePlanExercises,
      index.activePlanFuse,
      normalizedQuery,
      filters,
    ),
    favoriteExercises: searchBucket(
      index.favoriteExercises,
      index.favoriteFuse,
      normalizedQuery,
      filters,
    ),
    otherExercises: searchBucket(
      index.otherExercises,
      index.otherFuse,
      normalizedQuery,
      filters,
    ),
  };
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
