import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { openDatabase } from "@/utils/database";
import { ensureAppExercisesExist } from "@/utils/loadPremadePlans";
import { resolveExerciseId } from "@/utils/importUtils";
import { SharedPlan } from "@/types/firestore";

export const useImportPlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: SharedPlan): Promise<number> => {
      const db = await openDatabase("userData.db");

      const appExerciseIds = plan.workouts
        .flatMap((w) => w.exercises)
        .map((e) => e.appExerciseId)
        .filter((id): id is number => id !== null);
      await ensureAppExercisesExist(db, appExerciseIds);

      let newPlanId = 0;
      await db.withExclusiveTransactionAsync(async (txn) => {
        const planResult = await txn.runAsync(
          `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
          [plan.name, plan.imageUrl ?? null],
        );
        newPlanId = planResult.lastInsertRowId;

        for (const [workoutOrder, workout] of plan.workouts.entries()) {
          const workoutResult = await txn.runAsync(
            `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
            [newPlanId, workout.name, workoutOrder],
          );
          const workoutId = workoutResult.lastInsertRowId;

          for (const [exerciseOrder, exercise] of workout.exercises.entries()) {
            const exerciseId = await resolveExerciseId(txn, exercise);
            await txn.runAsync(
              `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                workoutId,
                exerciseId,
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId ?? null,
                exercise.trackingTypeOverride ?? null,
              ],
            );
          }
        }
      });
      return newPlanId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["allPlans"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
