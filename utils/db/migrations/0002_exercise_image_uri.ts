import type { SQLiteDatabase } from "expo-sqlite";

// Exercise thumbnails move out of the image BLOB into files, so lists can hand
// a uri to expo-image instead of base64-decoding bytes on the JS thread. The
// column starts empty for library exercises; writeExerciseImageFiles fills it
// in after boot. Custom exercises already keep their photo on disk.
export const up = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(`ALTER TABLE exercises ADD COLUMN image_uri TEXT;`);
  await db.execAsync(`
    UPDATE exercises
    SET image_uri = local_animated_uri
    WHERE app_exercise_id IS NULL
      AND local_animated_uri IS NOT NULL
      AND local_animated_uri != '';
  `);
};
