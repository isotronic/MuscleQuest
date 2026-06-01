import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { openDatabase } from "@/utils/database";
import { ensureAppExercisesExist } from "@/utils/loadPremadePlans";
import { resolveExerciseId } from "@/utils/importUtils";
import { SharedStandaloneWorkout } from "@/types/firestore";

export const useImportStandaloneWorkoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workout: SharedStandaloneWorkout): Promise<number> => {
      const db = await openDatabase("userData.db");

      const appExerciseIds = workout.exercises
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

        for (const [exerciseOrder, exercise] of workout.exercises.entries()) {
          const exerciseId = await resolveExerciseId(txn, exercise);
          await txn.runAsync(
            `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              newWorkoutId,
              exerciseId,
              JSON.stringify(exercise.sets),
              exerciseOrder,
              exercise.supersetGroupId ?? null,
              exercise.trackingTypeOverride ?? null,
            ],
          );
        }
      });
      return newWorkoutId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
