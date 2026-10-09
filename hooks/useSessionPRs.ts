import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { usePriorBestsQuery } from "@/hooks/useWorkoutSummariesQuery";
import { computeSessionPRs, type SessionPRs } from "@/utils/sessionPRs";
import type { PriorBest } from "@/utils/db/workoutStats";

const NONE: SessionPRs = {};

/**
 * The new personal records in the session in progress, and the inputs to
 * check a set before it is completed. Nothing counts in a deload week.
 */
export function useSessionPRs() {
  const { workout, activeWorkout, completedSets, weightAndReps } =
    useActiveWorkoutStore(
      useShallow((s) => ({
        workout: s.workout,
        activeWorkout: s.activeWorkout,
        completedSets: s.completedSets,
        weightAndReps: s.weightAndReps,
      })),
    );
  const { data: settings } = useSettingsQuery();
  const { isCurrentWeekDeload } = useDeloadWeekQuery(
    activeWorkout?.planId ?? undefined,
  );

  const exerciseIds = useMemo(
    () =>
      [...new Set(workout?.exercises.map((e) => e.exercise_id) ?? [])].sort(
        (a, b) => a - b,
      ),
    [workout?.exercises],
  );
  const { data: priorBests } = usePriorBestsQuery(exerciseIds);

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const bodyWeightKg = parseFloat(settings?.bodyWeight ?? "") || 0;
  const enabled = !isCurrentWeekDeload && !!priorBests && !!workout;

  const prs = useMemo(
    () =>
      enabled
        ? computeSessionPRs({
            exercises: workout!.exercises,
            completedSets,
            weightAndReps,
            priorBests: priorBests!,
            weightUnit,
            distanceUnit,
            bodyWeightKg,
          })
        : NONE,
    [
      enabled,
      workout,
      completedSets,
      weightAndReps,
      priorBests,
      weightUnit,
      distanceUnit,
      bodyWeightKg,
    ],
  );

  /** The PRs as they would be with one more set completed. */
  const prsWithSetCompleted = (
    exerciseIndex: number,
    setIndex: number,
  ): SessionPRs => {
    if (!enabled) return NONE;
    const live = useActiveWorkoutStore.getState();
    return computeSessionPRs({
      exercises: live.workout?.exercises ?? [],
      completedSets: {
        ...live.completedSets,
        [exerciseIndex]: {
          ...(live.completedSets[exerciseIndex] ?? {}),
          [setIndex]: true,
        },
      },
      weightAndReps: live.weightAndReps,
      priorBests: priorBests as PriorBest[],
      weightUnit,
      distanceUnit,
      bodyWeightKg,
    });
  };

  return { prs, prsWithSetCompleted };
}
