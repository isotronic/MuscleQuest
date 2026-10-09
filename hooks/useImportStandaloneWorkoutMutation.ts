import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { openDatabase } from "@/utils/database";
import { ensureAppExercisesExist } from "@/utils/loadPremadePlans";
import {
  ImportValidationError,
  resolveExerciseId,
  sanitizeImportedExercise,
} from "@/utils/importUtils";
import { showSnackbar } from "@/store/snackbarStore";
import { t } from "@lingui/core/macro";
import { SharedStandaloneWorkout } from "@/types/firestore";

export const useImportStandaloneWorkoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workout: SharedStandaloneWorkout): Promise<number> => {
      // Validate before opening the database; see useImportPlanMutation.
      const exercises = workout.exercises.map(sanitizeImportedExercise);
      const db = await openDatabase("userData.db");
      try {
        const appExerciseIds = exercises
          .map((e) => e.appExerciseId)
          .filter((id): id is number => id !== null);
        await ensureAppExercisesExist(db, appExerciseIds);

        let newWorkoutId = 0;
        await db.withExclusiveTransactionAsync(async (txn) => {
          const workoutResult = await txn.runAsync(
            `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (NULL, ?, 0)`,
            [workout.name],
          );
          newWorkoutId = workoutResult.lastInsertRowId;

          for (const [exerciseOrder, exercise] of exercises.entries()) {
            const exerciseId = await resolveExerciseId(txn, exercise);
            await txn.runAsync(
              `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                newWorkoutId,
                exerciseId,
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId,
                exercise.trackingTypeOverride,
              ],
            );
          }
        });
        return newWorkoutId;
      } finally {
        await db.closeAsync();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
    },
    onError: (error: Error) => {
      if (error instanceof ImportValidationError) {
        showSnackbar(
          t`This workout couldn't be added because some of its sets aren't valid.`,
        );
        return;
      }
      notifyBugsnag(error);
    },
  });
};
