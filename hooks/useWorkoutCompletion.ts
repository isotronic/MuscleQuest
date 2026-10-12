import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import type { Workout } from "@/store/workoutStore";
import { applyWorkoutChanges, diffWorkout } from "@/utils/workoutChanges";
import type { AskWhichChanges } from "@/hooks/useWorkoutChangesPrompt";

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

/**
 * Decides what happens after a finished session has been saved: quick
 * workouts go to the save-as-workout prompt; plan and standalone workouts
 * with structural edits get one question listing them, so the user can
 * keep any of them for future sessions, then the summary.
 */
export function useWorkoutCompletion(askWhichChanges: AskWhichChanges) {
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

      if (workoutId == null || originalWorkout == null) {
        return { next: "summary", updated: null };
      }
      const changes = diffWorkout(originalWorkout, workout);
      if (changes.length === 0) return { next: "summary", updated: null };

      const isPlan = planId != null;
      const chosen = await askWhichChanges({ changes, isPlan });
      if (!chosen || chosen.length === 0) {
        return { next: "summary", updated: null };
      }
      const exercises = applyWorkoutChanges(originalWorkout, workout, chosen);

      try {
        if (isPlan) {
          await updatePlanWorkoutExercises(workoutId, exercises);
          await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
          await queryClient.invalidateQueries({ queryKey: ["activePlan"] });
          return { next: "summary", updated: "plan" };
        }
        await updateStandaloneWorkout(workoutId, workout.name, exercises);
        await queryClient.invalidateQueries({
          queryKey: ["standaloneWorkouts"],
        });
        return { next: "summary", updated: "workout" };
      } catch (e) {
        notifyBugsnag(e as Error);
        return { next: "summary", updated: null, updateFailed: true };
      }
    },
    [queryClient, askWhichChanges],
  );
}
