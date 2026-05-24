import { useMemo, useRef, useState, useEffect } from "react";
import type { Exercise } from "@/utils/database";
import {
  buildExerciseSearchIndex,
  searchExercises,
  getExerciseSuggestions,
  type AutocompleteSuggestion,
  type SearchFilters,
} from "@/utils/exerciseSearch";

interface ExercisesInput {
  activePlanExercises?: Exercise[];
  favoriteExercises?: Exercise[];
  otherExercises: Exercise[];
}

interface FilteredExercisesResult {
  activePlanExercises: Exercise[];
  favoriteExercises: Exercise[];
  otherExercises: Exercise[];
}

interface ExerciseSearchResult {
  filteredExercises: FilteredExercisesResult;
  suggestions: AutocompleteSuggestion[];
  debouncedQuery: string;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [value, delay]);
  return debounced;
}

const EMPTY_EXERCISES: ExercisesInput = { otherExercises: [] };

export function useExerciseSearch(
  exercises: ExercisesInput | undefined,
  filters: SearchFilters,
  query: string,
): ExerciseSearchResult {
  const resolved = exercises ?? EMPTY_EXERCISES;

  const index = useMemo(
    () => buildExerciseSearchIndex(resolved),
    // exercises reference only changes when React Query refetches (~every 5 min)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      resolved.activePlanExercises,
      resolved.favoriteExercises,
      resolved.otherExercises,
    ],
  );

  const debouncedSearchQuery = useDebounce(query, 300);
  const debouncedSuggestionQuery = useDebounce(query, 150);

  const filteredExercises = useMemo((): FilteredExercisesResult => {
    const results = searchExercises(index, debouncedSearchQuery, filters);
    return {
      activePlanExercises: results.activePlanExercises.map((r) => r.exercise),
      favoriteExercises: results.favoriteExercises.map((r) => r.exercise),
      otherExercises: results.otherExercises.map((r) => r.exercise),
    };
  }, [index, debouncedSearchQuery, filters]);

  const suggestions = useMemo(
    () => getExerciseSuggestions(index, debouncedSuggestionQuery),
    [index, debouncedSuggestionQuery],
  );

  return {
    filteredExercises,
    suggestions,
    debouncedQuery: debouncedSearchQuery,
  };
}
