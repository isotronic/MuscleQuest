// Startup steps that bring userData.db in line with the content shipped in
// the exercise library (APP_DATA_DB). Each is gated on the app data sync
// version.
import Bugsnag from "@bugsnag/expo";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
  setAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";
import { databaseFilePath, openDatabase } from "./connection";
import { APP_DATA_DB } from "./appDataFile";

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
  const libraryPath = databaseFilePath(APP_DATA_DB).replace(/'/g, "''");
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
    appDataDB = await openDatabase(APP_DATA_DB);

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
                  // the row's own exercise_id, as in the insert below. The
                  // tracking type stays: refreshLibraryFromAppData changes it
                  // after converting what was logged and planned with it.
                  const values = updateColumns.map((col) =>
                    col === "app_exercise_id"
                      ? row["exercise_id"]
                      : col === "tracking_type"
                        ? existingEntry.tracking_type
                        : row[col],
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

    appDataDB = await openDatabase(APP_DATA_DB);
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

// The library columns a refresh rewrites. favorite, image_uri and
// local_animated_uri belong to the device and are only cleared when the
// image or animation they were made from changes.
const REFRESHED_COLUMNS = [
  "name",
  "image",
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

// A number logged or planned as reps for an exercise that is now timed is
// read as seconds only from this value up. Below it, it is more likely a
// count of holds, so the session or plan keeps reps.
export const MIN_SECONDS_FROM_REPS = 5;

const TYPE_OF = (column: string) => `COALESCE(NULLIF(${column}, ''), 'weight')`;

export interface LibraryRefreshSummary {
  exercisesUpdated: number;
  sessionsConverted: number;
  plansConverted: number;
  plansKeptOnReps: number;
}

// Sessions logged before resolved_tracking_type existed read the exercise's
// current type. Writing the old type in keeps them showing as they were
// logged, whatever the library changes to.
const lockLoggedType = (
  db: SQLite.SQLiteDatabase,
  exerciseId: number,
  oldType: string,
) =>
  db.runAsync(
    `UPDATE completed_exercises SET resolved_tracking_type = ?
     WHERE exercise_id = ? AND NULLIF(resolved_tracking_type, '') IS NULL`,
    [oldType, exerciseId],
  );

interface PlannedSet {
  repsMin?: number | null;
  repsMax?: number | null;
  time?: number | null;
  [key: string]: unknown;
}

const repsTarget = (set: PlannedSet): number | null => {
  const target = set.repsMax ?? set.repsMin;
  return typeof target === "number" ? target : null;
};

const toTimedSets = (sets: PlannedSet[]) =>
  sets.map(({ repsMin, repsMax, ...rest }) => {
    const target = repsTarget({ repsMin, repsMax });
    return target === null ? rest : { ...rest, time: rest.time ?? target };
  });

// Plan rows without an override follow the exercise's type. `sets` is null
// when the stored targets are not a list of set objects; such a row is
// never rewritten.
const planRowsFollowingType = async (
  db: SQLite.SQLiteDatabase,
  exerciseId: number,
) => {
  const planRows = await db.getAllAsync<{
    id: number;
    sets: string | null;
    deleted: number;
  }>(
    `SELECT id, sets, COALESCE(is_deleted, 0) AS deleted
     FROM user_workout_exercises
     WHERE exercise_id = ? AND NULLIF(tracking_type_override, '') IS NULL`,
    [exerciseId],
  );
  return planRows.map((row) => {
    let sets: PlannedSet[] | null = null;
    try {
      const parsed: unknown = JSON.parse(row.sets ?? "[]");
      if (
        Array.isArray(parsed) &&
        parsed.every((set) => typeof set === "object" && set !== null)
      ) {
        sets = parsed;
      }
    } catch {
      // Unreadable: left as null.
    }
    return { id: row.id, sets, deleted: !!row.deleted };
  });
};

const keepPlansOn = async (
  db: SQLite.SQLiteDatabase,
  planRowIds: number[],
  type: string,
) => {
  for (const id of planRowIds) {
    await db.runAsync(
      `UPDATE user_workout_exercises SET tracking_type_override = ? WHERE id = ?`,
      [type, id],
    );
  }
};

/**
 * Moves an exercise that changes from reps to time over as a whole: logged
 * sessions become time (each reps value read as seconds) and plan targets
 * become time targets, dropping unapplied progression suggestions, which
 * would suggest reps.
 *
 * Progress charts pick one type per exercise (a plan row's override, else
 * the exercise's type), so a mix would hide one side. Nothing is converted,
 * and every plan row keeps reps through its override, unless every session
 * and every plan target looks like seconds and no plan row already pins reps.
 */
const convertRepsToTime = async (
  db: SQLite.SQLiteDatabase,
  exerciseId: number,
): Promise<{ sessions: number; plans: number; keptOnReps: number }> => {
  // Deleted sessions and plan rows are converted with the rest but do not
  // decide: only what the user can see does.
  const sessions = await db.getAllAsync<{
    id: number;
    small: number;
    deleted: number;
  }>(
    `SELECT ce.id, EXISTS (
       SELECT 1 FROM completed_sets s
       WHERE s.completed_exercise_id = ce.id
         AND (s.is_deleted = FALSE OR s.is_deleted IS NULL)
         AND s.reps < ?) AS small,
       (COALESCE(ce.is_deleted, 0) OR COALESCE(cw.is_deleted, 0)) AS deleted
     FROM completed_exercises ce
     LEFT JOIN completed_workouts cw ON cw.id = ce.completed_workout_id
     WHERE ce.exercise_id = ? AND ce.resolved_tracking_type = 'reps'`,
    [MIN_SECONDS_FROM_REPS, exerciseId],
  );
  const plans = await planRowsFollowingType(db, exerciseId);
  const pinnedToReps = await db.getFirstAsync(
    `SELECT 1 FROM user_workout_exercises
     WHERE exercise_id = ? AND tracking_type_override = 'reps'
       AND (is_deleted = FALSE OR is_deleted IS NULL)
     LIMIT 1`,
    [exerciseId],
  );
  const looksLikeSeconds =
    !pinnedToReps &&
    sessions.every((session) => session.deleted || !session.small) &&
    plans.every(
      (plan) =>
        plan.deleted ||
        (plan.sets !== null &&
          plan.sets.every((set) => {
            const target = repsTarget(set);
            return target === null || target >= MIN_SECONDS_FROM_REPS;
          })),
    );

  if (!looksLikeSeconds) {
    await keepPlansOn(
      db,
      plans.map((plan) => plan.id),
      "reps",
    );
    return { sessions: 0, plans: 0, keptOnReps: plans.length };
  }
  // A deleted row that cannot be read keeps its targets, on reps.
  const unreadable = plans.filter((plan) => plan.sets === null);
  await keepPlansOn(
    db,
    unreadable.map((plan) => plan.id),
    "reps",
  );

  for (const { id } of sessions) {
    await db.runAsync(
      `UPDATE completed_sets SET time = COALESCE(time, reps), reps = NULL
       WHERE completed_exercise_id = ? AND reps IS NOT NULL`,
      [id],
    );
    await db.runAsync(
      `UPDATE completed_exercises SET resolved_tracking_type = 'time' WHERE id = ?`,
      [id],
    );
  }
  for (const plan of plans) {
    if (plan.sets === null) continue;
    await db.runAsync(
      `UPDATE user_workout_exercises SET sets = ? WHERE id = ?`,
      [JSON.stringify(toTimedSets(plan.sets)), plan.id],
    );
    await db.runAsync(
      `DELETE FROM exercise_progression_state
       WHERE user_workout_exercise_id = ? AND is_applied = 0`,
      [plan.id],
    );
  }
  return {
    sessions: sessions.length,
    plans: plans.length - unreadable.length,
    keptOnReps: unreadable.length,
  };
};

const refreshLibraryRows = async (
  db: SQLite.SQLiteDatabase,
): Promise<number> => {
  await db.execAsync(`
    INSERT INTO main.muscles (muscle)
      SELECT muscle FROM appdata.muscles
      WHERE muscle NOT IN (SELECT muscle FROM main.muscles);
    INSERT INTO main.equipment_list (equipment)
      SELECT equipment FROM appdata.equipment_list
      WHERE equipment NOT IN (SELECT equipment FROM main.equipment_list);
    INSERT INTO main.body_parts (body_part)
      SELECT body_part FROM appdata.body_parts
      WHERE body_part NOT IN (SELECT body_part FROM main.body_parts);
  `);
  // SET expressions read the row as it was before the update, so the CASEs
  // compare the old image and animation with the library's.
  const result = await db.runAsync(`
    UPDATE main.exercises AS e SET
      ${REFRESHED_COLUMNS.map((col) => `${col} = a.${col}`).join(",\n      ")},
      image_uri = CASE WHEN e.image IS NOT a.image THEN NULL ELSE e.image_uri END,
      local_animated_uri = CASE WHEN e.animated_url IS NOT a.animated_url
        THEN NULL ELSE e.local_animated_uri END
    FROM appdata.exercises AS a
    WHERE e.app_exercise_id = a.exercise_id
      AND (${REFRESHED_COLUMNS.map((col) => `e.${col} IS NOT a.${col}`).join(" OR ")})
  `);
  // Library exercises this device never received.
  await db.execAsync(`
    INSERT INTO main.exercises (${REFRESHED_COLUMNS.join(", ")}, app_exercise_id)
      SELECT ${REFRESHED_COLUMNS.join(", ")}, exercise_id FROM appdata.exercises
      WHERE exercise_id NOT IN (
        SELECT app_exercise_id FROM main.exercises
        WHERE app_exercise_id IS NOT NULL)
  `);
  return result.changes;
};

/**
 * Rewrites every library exercise from the shipped library and adds any the
 * device lacks, so existing installs get corrections that new installs copy
 * directly. Where an exercise's tracking type changes, what the user already
 * logged and planned is kept readable first (see lockLoggedType,
 * convertRepsToTime and keepPlansOn). All of it is one transaction with the
 * sync version bump: a failure leaves nothing half done and runs again next
 * boot.
 *
 * Runs after the earlier steps: its sync version is above theirs. On a new install
 * the rows already match, so it changes nothing.
 */
export const refreshLibraryFromAppData = async (): Promise<void> => {
  const userDataDB = await openDatabase("userData.db");
  try {
    const syncVersion = await getAppDataSyncVersion(userDataDB);
    if (syncVersion >= APP_DATA_SYNC.libraryRefreshed) return;

    const libraryPath = databaseFilePath(APP_DATA_DB).replace(/'/g, "''");
    // ATTACH cannot run inside a transaction, so it wraps the transaction.
    await userDataDB.execAsync(`ATTACH DATABASE '${libraryPath}' AS appdata`);
    try {
      await userDataDB.execAsync("BEGIN TRANSACTION");
      try {
        const summary: LibraryRefreshSummary = {
          exercisesUpdated: 0,
          sessionsConverted: 0,
          plansConverted: 0,
          plansKeptOnReps: 0,
        };
        const typeChanges = await userDataDB.getAllAsync<{
          exercise_id: number;
          old_type: string;
          new_type: string;
        }>(
          `SELECT e.exercise_id, ${TYPE_OF("e.tracking_type")} AS old_type,
                  ${TYPE_OF("a.tracking_type")} AS new_type
           FROM main.exercises e
           JOIN appdata.exercises a ON a.exercise_id = e.app_exercise_id
           WHERE ${TYPE_OF("e.tracking_type")} <> ${TYPE_OF("a.tracking_type")}`,
        );
        for (const change of typeChanges) {
          await lockLoggedType(userDataDB, change.exercise_id, change.old_type);
          if (change.old_type === "reps" && change.new_type === "time") {
            const converted = await convertRepsToTime(
              userDataDB,
              change.exercise_id,
            );
            summary.sessionsConverted += converted.sessions;
            summary.plansConverted += converted.plans;
            summary.plansKeptOnReps += converted.keptOnReps;
          } else {
            // No conversion for this change: plans keep the type their
            // targets were written for, as logged sessions now do.
            const plans = await planRowsFollowingType(
              userDataDB,
              change.exercise_id,
            );
            await keepPlansOn(
              userDataDB,
              plans.map((plan) => plan.id),
              change.old_type,
            );
          }
        }
        summary.exercisesUpdated = await refreshLibraryRows(userDataDB);
        await setAppDataSyncVersion(userDataDB, APP_DATA_SYNC.libraryRefreshed);
        await userDataDB.execAsync("COMMIT");
        Bugsnag.leaveBreadcrumb("Library refreshed", { ...summary });
      } catch (error) {
        await safeRollback(userDataDB);
        throw error;
      }
    } finally {
      try {
        await userDataDB.execAsync("DETACH DATABASE appdata");
      } catch (detachError) {
        console.error("Detaching the library failed:", detachError);
      }
    }
  } finally {
    await userDataDB.closeAsync();
  }
};
