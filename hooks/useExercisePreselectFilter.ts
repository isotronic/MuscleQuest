import { useState } from "react";
import { useLocalSearchParams } from "expo-router";

/**
 * Derives the pre-selected target muscle from route params when navigating to
 * an exercises screen to replace an existing exercise, and tracks whether the
 * FilterRow has finished rendering with that pre-selected value.
 *
 * Returns:
 *  - `initialTargetMuscle` – seed value for the `selectedTargetMuscle` state
 *  - `isPreselectLoading`  – true until FilterRow signals it has rendered the
 *                            pre-selected value (use to keep the screen hidden)
 *  - `replaceExerciseIndex` – index of the exercise being replaced, or `undefined` if not replacing
 */
export function useExercisePreselectFilter() {
  const { targetMuscle, replaceExerciseIndex: replaceExerciseIndexParam } =
    useLocalSearchParams();

  const replaceExerciseIndex =
    typeof replaceExerciseIndexParam === "string"
      ? Number(replaceExerciseIndexParam)
      : undefined;

  const initialTargetMuscle =
    typeof targetMuscle === "string" && replaceExerciseIndex !== undefined
      ? targetMuscle
      : null;

  const [filterReady, setFilterReady] = useState(false);

  const isPreselectLoading = !!initialTargetMuscle && !filterReady;
  const onFilterReady = initialTargetMuscle
    ? () => setFilterReady(true)
    : undefined;

  return {
    initialTargetMuscle,
    isPreselectLoading,
    onFilterReady,
    replaceExerciseIndex,
  };
}
