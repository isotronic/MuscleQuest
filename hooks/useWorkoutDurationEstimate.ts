import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSetDurationsForExercises } from "@/utils/database";
import {
  computeWorkoutDurationEstimate,
  type DurationEstimate,
} from "@/utils/estimateWorkoutDuration";
import type { UserExercise } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export function useWorkoutDurationEstimate(exercises: UserExercise[]): {
  estimate: DurationEstimate | null;
  isLoading: boolean;
} {
  const exerciseIds = useMemo(
    () => exercises.map((e) => e.exercise_id),
    [exercises],
  );

  const { data, isLoading } = useQuery<Record<number, number[]>>({
    queryKey: ["exerciseSetDurations", exerciseIds],
    queryFn: async () => {
      try {
        return await fetchSetDurationsForExercises(exerciseIds);
      } catch (error: any) {
        Bugsnag.notify(error);
        throw error;
      }
    },
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const estimate = useMemo(() => {
    if (exercises.length === 0) return null;
    return computeWorkoutDurationEstimate(exercises, data ?? {});
  }, [exercises, data]);

  return { estimate, isLoading };
}
