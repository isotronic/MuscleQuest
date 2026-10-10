import { markReported, notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import { openDatabase } from "./connection";

export interface Exercise {
  exercise_id: number;
  app_exercise_id?: number;
  name: string;
  /** Thumbnail bytes. Empty once the thumbnail is on disk, see image_uri. */
  image: number[];
  /** Thumbnail file written by writeExerciseImageFiles, or a custom photo. */
  image_uri?: string | null;
  local_animated_uri: string;
  animated_url: string;
  equipment: string;
  body_part: string;
  target_muscle: string;
  secondary_muscles: string[];
  description: string;
  tracking_type?: string;
  favorite?: number;
  is_unilateral?: number;
  double_weight?: number;
}

const IMAGE_UNLESS_ON_DISK = `CASE WHEN image_uri IS NULL THEN image END AS image`;

export const fetchAllRecords = async (
  databaseName: string,
  tableName: string,
) => {
  const db = await openDatabase(databaseName);
  try {
    const allowedTables = [
      "user_plans",
      "exercises",
      "muscles",
      "body_parts",
      "equipment_list",
    ];
    if (!allowedTables.includes(tableName)) {
      const tableError = new Error("Invalid table name");
      notifyBugsnag(tableError);
      throw tableError;
    }

    // Check if the table contains an is_deleted field
    const tableInfo = await db.getAllAsync(`PRAGMA table_info(${tableName});`);
    const hasIsDeletedField = tableInfo.some(
      (column: any) => column.name === "is_deleted",
    );

    // The thumbnail bytes are only needed until the image is on disk. Leaving
    // them out keeps the whole library's blobs from crossing into JS.
    const columns =
      tableName === "exercises"
        ? tableInfo
            .map((column: any) =>
              column.name === "image" ? IMAGE_UNLESS_ON_DISK : column.name,
            )
            .join(", ")
        : "*";

    // Build the query accordingly
    const query = hasIsDeletedField
      ? `SELECT ${columns} FROM ${tableName} WHERE is_deleted = FALSE`
      : `SELECT ${columns} FROM ${tableName}`;

    return await db.getAllAsync(query);
  } finally {
    await db.closeAsync();
  }
};

export const fetchRecord = async (
  databaseName: string,
  tableName: string,
  id: number,
) => {
  const allowedTables = [
    "user_plans",
    "exercises",
    "muscles",
    "body_parts",
    "equipment_list",
  ];
  if (!allowedTables.includes(tableName)) {
    const tableError = new Error("Invalid table name");
    notifyBugsnag(tableError);
    throw tableError;
  }
  const db = await openDatabase(databaseName);
  const fieldName = tableName === "exercises" ? "exercise_id" : "id";
  try {
    return await db.getFirstAsync(
      `SELECT * FROM ${tableName} WHERE ${fieldName} = ?`,
      [id],
    );
  } catch (error: any) {
    console.error("Error fetching record:", error);
    notifyBugsnag(error);
    const wrappedError = new Error("Error fetching record");
    markReported(wrappedError);
    throw wrappedError;
  } finally {
    await db.closeAsync();
  }
};

export const fetchMusclesByFilters = async (
  bodyPart: string | null,
  equipment: string | null,
) => {
  const db = await openDatabase("userData.db");
  try {
    const conditions = ["is_deleted = 0"];
    const params: string[] = [];
    if (bodyPart && bodyPart !== "all") {
      conditions.push("body_part = ?");
      params.push(bodyPart);
    }
    if (equipment && equipment !== "all") {
      conditions.push("equipment = ?");
      params.push(equipment);
    }
    return await db.getAllAsync<{ target_muscle: string }>(
      `SELECT DISTINCT target_muscle FROM exercises WHERE ${conditions.join(" AND ")} ORDER BY target_muscle`,
      params,
    );
  } finally {
    await db.closeAsync();
  }
};

export const insertAnimatedImageUri = async (
  exercise_id: number,
  local_animated_uri: string,
) => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(
      `UPDATE exercises SET local_animated_uri = ? WHERE exercise_id = ?`,
      [local_animated_uri, exercise_id],
    );
  } finally {
    await db.closeAsync();
  }
};

export const insertAnimatedImageUris = async (
  uris: { exercise_id: number; local_animated_uri: string }[],
) => {
  if (uris.length === 0) return;
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const { exercise_id, local_animated_uri } of uris) {
        await txn.runAsync(
          `UPDATE exercises SET local_animated_uri = ? WHERE exercise_id = ?`,
          [local_animated_uri, exercise_id],
        );
      }
    });
  } finally {
    await db.closeAsync();
  }
};

export interface ExerciseWithoutLocalAnimatedUriRow {
  exercise_id: number;
  animated_url: string;
}

export const fetchExercisesWithoutLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  try {
    return (await db.getAllAsync(
      `SELECT exercise_id, animated_url FROM exercises WHERE animated_url IS NOT NULL AND animated_url != '' AND (local_animated_uri IS NULL OR local_animated_uri = '')`,
    )) as ExerciseWithoutLocalAnimatedUriRow[];
  } finally {
    await db.closeAsync();
  }
};

export interface ExerciseWithLocalAnimatedUriRow {
  exercise_id: number;
  local_animated_uri: string;
}

export const fetchExercisesWithLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  try {
    return (await db.getAllAsync(
      `SELECT exercise_id, local_animated_uri FROM exercises WHERE local_animated_uri IS NOT NULL AND local_animated_uri != ''`,
    )) as ExerciseWithLocalAnimatedUriRow[];
  } finally {
    await db.closeAsync();
  }
};

export const clearAllLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(`UPDATE exercises SET local_animated_uri = NULL`);
  } finally {
    await db.closeAsync();
  }
};

export const fetchExerciseImagesByIds = async (
  exerciseIds: number[],
): Promise<Record<number, any>> => {
  if (exerciseIds.length === 0) {
    return {};
  }

  const db = await openDatabase("userData.db");

  // Create a comma-separated list of placeholders (?, ?, ...)
  const placeholders = exerciseIds.map(() => "?").join(",");

  try {
    const results = await db.getAllAsync(
      `SELECT exercise_id, image FROM exercises WHERE exercise_id IN (${placeholders});`,
      exerciseIds,
    );

    // Map exercise IDs to their images
    const imagesMap: Record<number, any> = {};
    results.forEach((row: any) => {
      imagesMap[row.exercise_id] = row.image;
    });

    return imagesMap;
  } catch (error: any) {
    console.error("Error fetching exercise images:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    await db.closeAsync();
  }
};

export const reorderTrackedExercises = async (
  exerciseIds: number[],
): Promise<void> => {
  if (exerciseIds.length === 0) return;
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (let i = 0; i < exerciseIds.length; i++) {
        await txn.runAsync(
          `UPDATE tracked_exercises SET sort_order = ? WHERE exercise_id = ?`,
          [i, exerciseIds[i]],
        );
      }
    });
  } catch (error: any) {
    console.error("Error reordering tracked exercises:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

// Pinned exercises ("Pinned to Stats") live in tracked_exercises. New pins
// go to the end of the Stats widget's order.
const PIN_EXERCISE_SQL = `INSERT OR IGNORE INTO tracked_exercises (exercise_id, sort_order)
  VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tracked_exercises))`;
const UNPIN_EXERCISE_SQL = `DELETE FROM tracked_exercises WHERE exercise_id = ?`;

export const isExercisePinned = async (
  exerciseId: number,
): Promise<boolean> => {
  const db = await openDatabase("userData.db");
  try {
    const row = await db.getFirstAsync<{ exercise_id: number }>(
      `SELECT exercise_id FROM tracked_exercises WHERE exercise_id = ?`,
      [exerciseId],
    );
    return row != null;
  } finally {
    await db.closeAsync();
  }
};

export const pinExercise = async (exerciseId: number): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(PIN_EXERCISE_SQL, [exerciseId]);
  } finally {
    await db.closeAsync();
  }
};

export const unpinExercise = async (exerciseId: number): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(UNPIN_EXERCISE_SQL, [exerciseId]);
  } finally {
    await db.closeAsync();
  }
};

/** Makes the pinned set exactly `exerciseIds`, keeping existing pins' order. */
export const setPinnedExercises = async (
  exerciseIds: number[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    const pinned = await db.getAllAsync<{ exercise_id: number }>(
      `SELECT exercise_id FROM tracked_exercises`,
    );
    const pinnedIds = pinned.map((row) => Number(row.exercise_id));
    const toPin = exerciseIds.filter((id) => !pinnedIds.includes(id));
    const toUnpin = pinnedIds.filter((id) => !exerciseIds.includes(id));
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const id of toPin) await txn.runAsync(PIN_EXERCISE_SQL, [id]);
      for (const id of toUnpin) await txn.runAsync(UNPIN_EXERCISE_SQL, [id]);
    });
  } finally {
    await db.closeAsync();
  }
};
