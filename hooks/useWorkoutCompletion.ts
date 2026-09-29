import { useCallback } from "react";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import {
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import type { UserExercise, Workout } from "@/store/workoutStore";

export function hasStructuralChanges(
  current: Workout,
  original: Workout,
): boolean {
  const toKey = (exercises: UserExercise[]) =>
    JSON.stringify(
      exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: e.sets,
        supersetGroupId: e.supersetGroupId ?? null,
        tracking_type_override: e.tracking_type_override ?? null,
      })),
    );
  return toKey(current.exercises) !== toKey(original.exercises);
}

export interface CompletionInput {
  isQuickWorkout: boolean;
  planId: number | null | undefined;
  workoutId: number | null | undefined;
  workout: Workout;
  originalWorkout: Workout | null;
}

export interface CompletionOutcome {
  /** quickSave: offer to save the quick workout; summary: show the summary. */
  next: "quickSave" | "summary";
  updated: "plan" | "workout" | null;
  updateFailed?: true;
}

/** One question, resolved with whether the user chose to apply the changes. */
const askToApply = (title: string, keepLabel: string, applyLabel: string) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      t`You changed this workout. Apply those changes to future sessions?`,
      [
        { text: keepLabel, style: "cancel", onPress: () => resolve(false) },
        { text: applyLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

/**
 * Decides what happens after a finished session has been saved: quick
 * workouts go to the save-as-workout prompt; plan and standalone workouts
 * with structural edits get one question about applying them to future
 * sessions, then the summary.
 */
export function useWorkoutCompletion() {
  const queryClient = useQueryClient();

  return useCallback(
    async ({
      isQuickWorkout,
      planId,
      workoutId,
      workout,
      originalWorkout,
    }: CompletionInput): Promise<CompletionOutcome> => {
      if (isQuickWorkout) return { next: "quickSave", updated: null };

      const changed =
        workoutId != null &&
        originalWorkout != null &&
        hasStructuralChanges(workout, originalWorkout);
      if (!changed) return { next: "summary", updated: null };

      const isPlan = planId != null;
      const apply = isPlan
        ? await askToApply(
            t`Update your plan?`,
            t`Keep plan as is`,
            t`Update plan`,
          )
        : await askToApply(
            t`Update this workout?`,
            t`Keep workout as is`,
            t`Update workout`,
          );
      if (!apply) return { next: "summary", updated: null };

      try {
        if (isPlan) {
          await updatePlanWorkoutExercises(workoutId, workout.exercises);
          await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
          await queryClient.invalidateQueries({ queryKey: ["activePlan"] });
          return { next: "summary", updated: "plan" };
        }
        await updateStandaloneWorkout(
          workoutId,
          workout.name,
          workout.exercises,
        );
        await queryClient.invalidateQueries({
          queryKey: ["standaloneWorkouts"],
        });
        return { next: "summary", updated: "workout" };
      } catch (e) {
        notifyBugsnag(e as Error);
        return { next: "summary", updated: null, updateFailed: true };
      }
    },
    [queryClient],
  );
}
