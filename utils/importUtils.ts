import { SQLiteDatabase } from "expo-sqlite";
import { SharedExercise } from "@/types/firestore";

/**
 * Resolves a SharedExercise to a local exercise_id in userData.db.
 * For app exercises: looks up by app_exercise_id (must already exist — call
 * ensureAppExercisesExist before starting the transaction).
 * For custom exercises: matches by name (app_exercise_id IS NULL), inserting
 * a new row if no match is found.
 */
export const resolveExerciseId = async (
  db: SQLiteDatabase,
  exercise: SharedExercise,
): Promise<number> => {
  if (exercise.appExerciseId !== null) {
    const row = await db.getFirstAsync<{ exercise_id: number }>(
      "SELECT exercise_id FROM exercises WHERE app_exercise_id = ? LIMIT 1",
      [exercise.appExerciseId],
    );
    if (!row)
      throw new Error(
        `App exercise ${exercise.appExerciseId} not found in userData.db`,
      );
    return row.exercise_id;
  }

  const existing = await db.getFirstAsync<{ exercise_id: number }>(
    "SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND name = ? LIMIT 1",
    [exercise.name],
  );
  if (existing) return existing.exercise_id;

  const result = await db.runAsync(
    `INSERT INTO exercises (app_exercise_id, name, body_part, target_muscle, equipment, secondary_muscles, tracking_type, is_unilateral, double_weight, animated_url)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.name,
      exercise.bodyPart,
      exercise.targetMuscle,
      exercise.equipment,
      JSON.stringify(exercise.secondaryMuscles),
      exercise.trackingType,
      exercise.isUnilateral ? 1 : 0,
      exercise.doubleWeight ? 1 : 0,
      exercise.animatedUrl,
    ],
  );
  return result.lastInsertRowId;
};
