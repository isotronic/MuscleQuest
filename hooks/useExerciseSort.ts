import { useMemo } from "react";
import { t } from "@lingui/core/macro";
import type { Exercise } from "@/utils/database";
import type { ExerciseUsage } from "./useExerciseUsageQuery";
import type { SortMode } from "@/components/ExerciseSortChips";

interface FilteredExercises {
  activePlanExercises: Exercise[];
  favoriteExercises: Exercise[];
  otherExercises: Exercise[];
}

export function useExerciseSort(
  sortMode: SortMode,
  filteredExercises: FilteredExercises,
  usageData: ExerciseUsage[] | undefined,
) {
  const sortedExercises = useMemo(() => {
    if (sortMode === "default" || sortMode === "activePlan") {
      return filteredExercises;
    }

    const usageMap = new Map(usageData?.map((u) => [u.exerciseId, u]) ?? []);
    const allExercises = [
      ...filteredExercises.activePlanExercises,
      ...filteredExercises.favoriteExercises,
      ...filteredExercises.otherExercises,
    ];

    const withUsage = allExercises.filter((e) => usageMap.has(e.exercise_id));
    const withoutUsage = allExercises.filter(
      (e) => !usageMap.has(e.exercise_id),
    );

    if (sortMode === "recent") {
      withUsage.sort((a, b) =>
        usageMap
          .get(b.exercise_id)!
          .lastUsed.localeCompare(usageMap.get(a.exercise_id)!.lastUsed),
      );
    } else {
      withUsage.sort(
        (a, b) =>
          usageMap.get(b.exercise_id)!.useCount -
          usageMap.get(a.exercise_id)!.useCount,
      );
    }

    return {
      activePlanExercises: withUsage,
      favoriteExercises: [],
      otherExercises: withoutUsage,
    };
  }, [sortMode, filteredExercises, usageData]);

  const sectionTitles = useMemo(() => {
    if (sortMode === "recent") return { activePlan: t`Recently Used` };
    if (sortMode === "frequent") return { activePlan: t`Most Used` };
    return undefined;
  }, [sortMode]);

  return { sortedExercises, sectionTitles };
}
