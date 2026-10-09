import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { openDatabase } from "@/utils/database";
import { ensureAppExercisesExist } from "@/utils/loadPremadePlans";
import {
  ImportValidationError,
  resolveExerciseId,
  sanitizeImportedWorkouts,
} from "@/utils/importUtils";
import { showSnackbar } from "@/store/snackbarStore";
import { t } from "@lingui/core/macro";
import { SharedPlan } from "@/types/firestore";

export const useImportPlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: SharedPlan): Promise<number> => {
      // Validate everything before opening the database: a friend's plan is
      // untrusted input, and a bad exercise must not leave half a plan behind.
      const workouts = sanitizeImportedWorkouts(plan.workouts);
      const db = await openDatabase("userData.db");
      try {
        const appExerciseIds = workouts
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

          for (const [workoutOrder, workout] of workouts.entries()) {
            const workoutResult = await txn.runAsync(
              `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
              [newPlanId, workout.name, workoutOrder],
            );
            const workoutId = workoutResult.lastInsertRowId;

            for (const [
              exerciseOrder,
              exercise,
            ] of workout.exercises.entries()) {
              const exerciseId = await resolveExerciseId(txn, exercise);
              await txn.runAsync(
                `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  workoutId,
                  exerciseId,
                  JSON.stringify(exercise.sets),
                  exerciseOrder,
                  exercise.supersetGroupId,
                  exercise.trackingTypeOverride,
                ],
              );
            }
          }
        });
        return newPlanId;
      } finally {
        await db.closeAsync();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["allPlans"] });
    },
    onError: (error: Error) => {
      if (error instanceof ImportValidationError) {
        showSnackbar(
          t`This plan couldn't be added because part of it isn't valid.`,
        );
        return;
      }
      notifyBugsnag(error);
    },
  });
};
