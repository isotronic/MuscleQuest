import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { applyHistoryEdits } from "@/utils/db/historyEdits";
import { buildHistoryEditOps, EditableWorkout } from "@/utils/historyEditOps";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import { syncCompletedWorkoutChanged } from "@/utils/sharedSync";

export interface CompletedWorkoutEdit {
  /** The workout as the edit screen loaded it, set values in display units. */
  original: EditableWorkout;
  /** The same workout after editing. */
  edited: EditableWorkout;
}

const HISTORY_KEYS = [
  ["completedWorkouts"],
  ["exerciseDetail"],
  ["exerciseHistory"],
  ["trackedExercises"],
  ["workoutSessionHistory"],
  ["globalExerciseHistoryForSession"],
];

export const useEditCompletedWorkoutMutation = (
  id: number,
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["completedWorkout", id] });
    // "completedWorkouts" also roots the stats widgets' keys, and its refetch
    // re-runs useWeeklyStreak against the recounted weeks.
    for (const queryKey of HISTORY_KEYS) {
      queryClient.invalidateQueries({ queryKey });
    }
  };
  return useMutation({
    mutationFn: ({ original, edited }: CompletedWorkoutEdit) =>
      applyHistoryEdits(
        id,
        buildHistoryEditOps(original, edited, weightUnit, distanceUnit),
      ),
    onSuccess: (result, edit) => {
      // A pending suggestion may have been built on the values just
      // corrected, and a new date can make this session the latest of its
      // workout, or make a session it moved past the latest instead.
      // One at a time: they can share plan exercises.
      void (async () => {
        for (const sessionId of [id, ...(result?.passedSessionIds ?? [])]) {
          await refreshProgressionAfterHistoryChange(queryClient, sessionId);
        }
      })();
      // Friends see the corrected values. The exercises from before the edit
      // are included because one swapped out or removed may have lost its PR.
      syncCompletedWorkoutChanged(
        id,
        edit.original.exercises.map((exercise) => exercise.exercise_id),
      );
    },
    onError: (error) => {
      console.error("Error saving edited workout:", error);
      notifyBugsnag(error);
      Alert.alert(
        t`Error`,
        t`An error occurred while saving your edited workout. Please try again.`,
      );
    },
    onSettled: invalidate,
  });
};
