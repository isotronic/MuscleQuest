import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { saveCompletedWorkout } from "@/utils/db/workouts";
import { assertNotFuture, recountWeekOf } from "@/utils/db/historyEdits";
import { EditableWorkout, toSavedWorkout } from "@/utils/historyEditOps";
import { toLocalDateKey } from "@/utils/dates";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import { syncCompletedWorkoutChanged } from "@/utils/sharedSync";

export interface PastWorkoutLog {
  workout: EditableWorkout;
  /** The saved workout it was logged from, so progression can use it. */
  source: { planId: number | null; workoutId: number } | null;
}

/**
 * Saves a workout done earlier and not logged at the time. It is written by
 * the same function as a live session, so stats and history treat it like
 * any other.
 */
const logPastWorkout = async (
  { workout, source }: PastWorkoutLog,
  weightUnit: string,
  distanceUnit: string,
): Promise<number> => {
  assertNotFuture(workout.completedAt);
  const saved = toSavedWorkout(workout, source, weightUnit, distanceUnit);
  const id = await saveCompletedWorkout(
    saved.planId,
    saved.workoutId,
    saved.duration,
    saved.totalSetsCompleted,
    false,
    saved.exercises,
    saved.completedAt,
    saved.notes,
  );
  // A week already recorded counts the new day too.
  try {
    await recountWeekOf(toLocalDateKey(workout.completedAt));
  } catch (error) {
    notifyBugsnag(error);
  }
  return id;
};

export const useLogPastWorkoutMutation = (
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (log: PastWorkoutLog) =>
      logPastWorkout(log, weightUnit, distanceUnit),
    onSuccess: (id) => {
      for (const queryKey of [
        ["completedWorkouts"],
        ["exerciseDetail"],
        ["exerciseHistory"],
        ["trackedExercises"],
        ["workoutSessionHistory"],
        ["globalExerciseHistoryForSession"],
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }
      // Changes a suggestion only if this is now the newest session of its
      // workout.
      void refreshProgressionAfterHistoryChange(queryClient, id);
      syncCompletedWorkoutChanged(id);
    },
    onError: (error) => {
      console.error("Error logging past workout:", error);
      notifyBugsnag(error);
      Alert.alert(t`Error`, t`Couldn't save this workout. Please try again.`);
    },
  });
};
