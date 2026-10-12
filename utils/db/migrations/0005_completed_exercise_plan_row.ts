import type { SQLiteDatabase } from "expo-sqlite";

// The plan row (user_workout_exercises.id) a logged exercise came from. A
// workout can hold the same exercise twice, so the exercise id alone cannot
// tell two blocks apart once one is skipped. NULL for older sessions, quick
// workouts and exercises added afterwards; readers fall back to matching by
// exercise and order.
export const up = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(
    `ALTER TABLE completed_exercises ADD COLUMN user_workout_exercise_id INTEGER DEFAULT NULL;`,
  );
};
