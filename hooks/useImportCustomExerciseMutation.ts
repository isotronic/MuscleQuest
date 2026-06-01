import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { openDatabase } from "@/utils/database";
import { SharedCustomExercise } from "@/types/firestore";

export const useImportCustomExerciseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (exercise: SharedCustomExercise): Promise<number> => {
      const db = await openDatabase("userData.db");
      const existing = await db.getFirstAsync<{ exercise_id: number }>(
        "SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND name = ? LIMIT 1",
        [exercise.name],
      );
      if (existing) return existing.exercise_id;

      const result = await db.runAsync(
        `INSERT INTO exercises (app_exercise_id, name, body_part, target_muscle, equipment, secondary_muscles, description, tracking_type, is_unilateral, double_weight, animated_url)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exercise.name,
          exercise.bodyPart,
          exercise.targetMuscle,
          exercise.equipment,
          JSON.stringify(exercise.secondaryMuscles),
          exercise.description,
          exercise.trackingType,
          exercise.isUnilateral ? 1 : 0,
          exercise.doubleWeight ? 1 : 0,
          exercise.animatedUrl,
        ],
      );
      return result.lastInsertRowId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
