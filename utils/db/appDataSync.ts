// Startup steps that bring userData.db in line with the content shipped in
// appData3.db. Each is gated on the app data sync version.
import Bugsnag from "@bugsnag/expo";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
  setAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";
import { databaseFilePath, openDatabase } from "./connection";

interface SQLiteRow {
  [key: string]: any;
}

// Rolls back without letting a rollback failure mask the original error.
const safeRollback = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  try {
    await db.execAsync("ROLLBACK");
  } catch (rollbackError) {
    console.error("Rollback failed:", rollbackError);
  }
};

export const updateAppExerciseIds = async (): Promise<void> => {
  const userDataDB = await openDatabase("userData.db");
  let inTransaction = false;
  try {
    const syncVersion = await getAppDataSyncVersion(userDataDB);

    if (syncVersion === APP_DATA_SYNC.legacyInstall) {
      // Find all exercises where app_exercise_id is NULL
      const nullAppExerciseIds: SQLiteRow[] = await userDataDB.getAllAsync(
        `SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND exercise_id BETWEEN 0 AND 779`,
      );

      if (nullAppExerciseIds.length > 0) {
        await userDataDB.execAsync("BEGIN TRANSACTION");
        inTransaction = true;

        for (const row of nullAppExerciseIds) {
          // Set the app_exercise_id to the value of exercise_id
          await userDataDB.runAsync(
            `UPDATE exercises SET app_exercise_id = ? WHERE exercise_id = ?`,
            [row.exercise_id, row.exercise_id],
          );
        }

        await userDataDB.execAsync("COMMIT");
        inTransaction = false;

        Bugsnag.leaveBreadcrumb("Linked legacy exercise ids", {
          count: nullAppExerciseIds.length,
        });
      }
      await setAppDataSyncVersion(userDataDB, APP_DATA_SYNC.exerciseIdsLinked);
    }
  } catch (error: any) {
    console.error("Error updating app_exercise_id:", error);
    notifyBugsnag(error);
    if (inTransaction) {
      await safeRollback(userDataDB);
    }
    throw error;
  } finally {
    await userDataDB.closeAsync();
  }
};

/** Called with rows done and total rows while a long startup step runs. */
export type ProgressCallback = (done: number, total: number) => void;

const EXERCISE_PROGRESS_BATCH = 50;

// The library columns a userData exercise row copies; app_exercise_id is the
// library row's own exercise_id.
const LIBRARY_EXERCISE_COLUMNS = [
  "name",
  "image",
  "local_animated_uri",
  "animated_url",
  "equipment",
  "body_part",
  "target_muscle",
  "secondary_muscles",
  "description",
  "is_deleted",
  "tracking_type",
  "is_unilateral",
  "double_weight",
];

// A fresh install has nothing to compare against, so the library goes in with
// one statement per table instead of a lookup and an insert per row. ATTACH
// cannot run inside a transaction, so it wraps the transaction.
const bulkCopyLibrary = async (
  userDataDB: SQLite.SQLiteDatabase,
  onProgress?: ProgressCallback,
): Promise<void> => {
  const libraryPath = databaseFilePath("appData3.db").replace(/'/g, "''");
  await userDataDB.execAsync(`ATTACH DATABASE '${libraryPath}' AS appdata`);
  try {
    const counted = await userDataDB.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM appdata.exercises",
    );
    const total = counted?.total ?? 0;
    onProgress?.(0, total);
    const columns = LIBRARY_EXERCISE_COLUMNS.join(", ");
    try {
      await userDataDB.execAsync(`
        BEGIN TRANSACTION;
        INSERT INTO main.muscles (muscle)
          SELECT muscle FROM appdata.muscles
          WHERE muscle NOT IN (SELECT muscle FROM main.muscles);
        INSERT INTO main.equipment_list (equipment)
          SELECT equipment FROM appdata.equipment_list
          WHERE equipment NOT IN (SELECT equipment FROM main.equipment_list);
        INSERT INTO main.body_parts (body_part)
          SELECT body_part FROM appdata.body_parts
          WHERE body_part NOT IN (SELECT body_part FROM main.body_parts);
        INSERT INTO main.exercises (${columns}, app_exercise_id)
          SELECT ${columns}, exercise_id FROM appdata.exercises;
        COMMIT;
      `);
    } catch (error) {
      await safeRollback(userDataDB);
      throw error;
    }
    onProgress?.(total, total);
  } finally {
    try {
      await userDataDB.execAsync("DETACH DATABASE appdata");
    } catch (detachError) {
      console.error("Detaching the library failed:", detachError);
    }
  }
};

export const copyDataFromAppDataToUserData = async (
  onProgress?: ProgressCallback,
): Promise<void> => {
  let appDataDB: SQLite.SQLiteDatabase | undefined;
  let userDataDB: SQLite.SQLiteDatabase | undefined;
  try {
    userDataDB = await openDatabase("userData.db");

    interface ExerciseCheckResult {
      app_exercise_id: number | null;
      name: string;
      image: Uint8Array | null;
      description: string | null;
      animated_url: string | null;
      equipment: string | null;
      tracking_type: string | null;
      is_deleted: number;
      is_unilateral?: boolean;
      double_weight?: boolean;
    }

    const syncVersion = await getAppDataSyncVersion(userDataDB);

    if (syncVersion >= APP_DATA_SYNC.exercisesCopied) {
      return;
    }

    const hasLibraryExercises = await userDataDB.getFirstAsync(
      "SELECT 1 FROM exercises WHERE app_exercise_id IS NOT NULL LIMIT 1",
    );
    if (!hasLibraryExercises) {
      await bulkCopyLibrary(userDataDB, onProgress);
      await setAppDataSyncVersion(userDataDB, APP_DATA_SYNC.exercisesCopied);
      Bugsnag.leaveBreadcrumb("Library exercises copied", { bulk: true });
      return;
    }

    // An install that already has library rows compares each one.
    appDataDB = await openDatabase("appData3.db");

    let shouldUpdateDataVersion = false;

    const copyTableData = async (
      tableName: string,
      columns: string[],
      excludeId: boolean = false,
    ): Promise<void> => {
      let inTransaction = false;
      try {
        const result: SQLiteRow[] = await appDataDB!.getAllAsync(
          `SELECT ${columns.join(", ")} FROM ${tableName}`,
        );

        if (result.length > 0) {
          await userDataDB!.execAsync("BEGIN TRANSACTION");
          inTransaction = true;

          const insertColumns = excludeId
            ? columns.filter((col) => col !== "exercise_id")
            : columns;

          const reportsProgress = tableName === "exercises" && onProgress;
          if (tableName === "exercises") {
            insertColumns.push("app_exercise_id");
          }
          if (reportsProgress) onProgress(0, result.length);

          const placeholders = insertColumns.map(() => "?").join(", ");
          const insertStatement = `INSERT INTO ${tableName} (${insertColumns.join(", ")}) VALUES (${placeholders})`;

          const updateColumns = insertColumns.filter(
            (col) => col !== "exercise_id",
          );
          const updatePlaceholders = updateColumns
            .map((col) => `${col} = ?`)
            .join(", ");
          // A rewritten row may carry a new thumbnail. Clearing image_uri
          // sends readers back to the bytes until writeExerciseImageFiles
          // replaces the file that was written from the old ones.
          const updateStatement = `UPDATE ${tableName} SET ${updatePlaceholders}, image_uri = NULL WHERE app_exercise_id = ?`;

          for (const [rowIndex, row] of result.entries()) {
            if (
              reportsProgress &&
              rowIndex > 0 &&
              rowIndex % EXERCISE_PROGRESS_BATCH === 0
            ) {
              onProgress(rowIndex, result.length);
            }
            let shouldInsertOrUpdate = true;

            if (
              ["muscles", "equipment_list", "body_parts"].includes(tableName)
            ) {
              // Define unique column for each of these tables
              const uniqueColumn =
                tableName === "muscles"
                  ? "muscle"
                  : tableName === "equipment_list"
                    ? "equipment"
                    : "body_part";

              const existingEntry = await userDataDB!.getFirstAsync(
                `SELECT * FROM ${tableName} WHERE ${uniqueColumn} = ? LIMIT 1`,
                [row[uniqueColumn]],
              );

              // Skip insertion if entry already exists
              if (existingEntry) {
                shouldInsertOrUpdate = false;
              }
            } else if (tableName === "exercises") {
              const existingEntry =
                await userDataDB!.getFirstAsync<ExerciseCheckResult>(
                  `SELECT * FROM ${tableName} WHERE app_exercise_id = ? LIMIT 1`,
                  [row["exercise_id"]],
                );

              if (existingEntry) {
                const fieldsToUpdate = insertColumns.filter((col) => {
                  switch (col) {
                    // case "app_exercise_id":
                    //   return row[col] !== existingEntry.app_exercise_id;
                    case "name":
                      return row[col] !== existingEntry.name;
                    // case "image":
                    //   return row[col] !== existingEntry.image;
                    case "description":
                      return row[col] !== existingEntry.description;
                    case "animated_url":
                      return row[col] !== existingEntry.animated_url;
                    case "is_deleted":
                      return row[col] !== existingEntry.is_deleted;
                    case "tracking_type":
                      return row[col] !== existingEntry.tracking_type;
                    case "equipment":
                      return row[col] !== existingEntry.equipment;
                    case "is_unilateral":
                      return row[col] !== existingEntry.is_unilateral;
                    case "double_weight":
                      return row[col] !== existingEntry.double_weight;
                    default:
                      return false;
                  }
                });

                if (fieldsToUpdate.length > 0) {
                  // The library row has no app_exercise_id column; it is
                  // the row's own exercise_id, as in the insert below.
                  const values = updateColumns.map((col) =>
                    col === "app_exercise_id" ? row["exercise_id"] : row[col],
                  );
                  values.push(row["exercise_id"]);
                  await userDataDB!.runAsync(updateStatement, values);
                }

                shouldInsertOrUpdate = false;
              }
            }

            if (shouldInsertOrUpdate) {
              const values = insertColumns.map((col) =>
                col === "app_exercise_id" ? row["exercise_id"] : row[col],
              );
              await userDataDB!.runAsync(insertStatement, values);
            }
          }

          await userDataDB!.execAsync("COMMIT");
          inTransaction = false;
          if (reportsProgress) onProgress(result.length, result.length);
        }
        shouldUpdateDataVersion = true;
      } catch (error: any) {
        console.error(`Error copying table ${tableName}:`, error);
        if (inTransaction) {
          await safeRollback(userDataDB!);
        }
        throw error;
      }
    };

    await copyTableData("muscles", ["muscle"]);
    await copyTableData("equipment_list", ["equipment"]);
    await copyTableData("body_parts", ["body_part"]);

    await copyTableData(
      "exercises",
      [
        "exercise_id", // Copy exercise_id to userData's app_exercise_id field later
        "name",
        "image",
        "local_animated_uri",
        "animated_url",
        "equipment",
        "body_part",
        "target_muscle",
        "secondary_muscles",
        "description",
        "is_deleted",
        "tracking_type",
        "is_unilateral",
        "double_weight",
      ],
      true, // Exclude the auto-incremented exercise_id for userData
    );

    if (shouldUpdateDataVersion) {
      await setAppDataSyncVersion(userDataDB, APP_DATA_SYNC.exercisesCopied);
      Bugsnag.leaveBreadcrumb("Library exercises copied");
    }
  } finally {
    if (userDataDB) await userDataDB.closeAsync();
    if (appDataDB) await appDataDB.closeAsync();
  }
};

// Copies is_unilateral / double_weight from the shipped library onto the
// user's library exercises. Custom exercises (app_exercise_id NULL) are never
// touched, and library exercises cannot be edited in the app, so this only
// ever overwrites values that came from an earlier copy of the library.
//
// Gated on exerciseFlagsResynced rather than the original exerciseFlagsSynced
// step: that one sat below the premade-plans step that runs before it, so
// anyone who updated straight past it never had their flags synced.
export const syncExerciseFlagsFromAppData = async (): Promise<void> => {
  let userDataDB: SQLite.SQLiteDatabase | undefined;
  let appDataDB: SQLite.SQLiteDatabase | undefined;
  try {
    userDataDB = await openDatabase("userData.db");
    const syncVersion = await getAppDataSyncVersion(userDataDB);
    if (syncVersion >= APP_DATA_SYNC.exerciseFlagsResynced) return;

    appDataDB = await openDatabase("appData3.db");
    const appExercises = await appDataDB.getAllAsync<{
      exercise_id: number;
      is_unilateral: number;
      double_weight: number;
    }>("SELECT exercise_id, is_unilateral, double_weight FROM exercises");

    await userDataDB.execAsync("BEGIN TRANSACTION");
    try {
      for (const ex of appExercises) {
        await userDataDB.runAsync(
          "UPDATE exercises SET is_unilateral = ?, double_weight = ? WHERE app_exercise_id = ?",
          [ex.is_unilateral ?? 0, ex.double_weight ?? 0, ex.exercise_id],
        );
      }
      await setAppDataSyncVersion(
        userDataDB,
        APP_DATA_SYNC.exerciseFlagsResynced,
      );
      await userDataDB.execAsync("COMMIT");
    } catch (err) {
      await safeRollback(userDataDB);
      notifyBugsnag(err as Error);
      throw err;
    }
  } finally {
    if (appDataDB) await appDataDB.closeAsync();
    if (userDataDB) await userDataDB.closeAsync();
  }
};
