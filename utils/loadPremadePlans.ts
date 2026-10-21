import { Plan } from "@/hooks/useAllPlansQuery";
import { openDatabase, type ProgressCallback } from "./database";
import { SQLiteDatabase } from "expo-sqlite";
import { APP_DATA_DB } from "./db/appDataFile";
import Bugsnag from "@bugsnag/expo";
import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
  setAppDataSyncVersion,
} from "./db/appDataSyncVersion";

export const ensureAppExercisesExist = async (
  userDb: SQLiteDatabase,
  appExerciseIds: number[],
): Promise<void> => {
  const appDb = await openDatabase(APP_DATA_DB);
  try {
    for (const appId of appExerciseIds) {
      const exists = await userDb.getFirstAsync(
        "SELECT exercise_id FROM exercises WHERE app_exercise_id = ? LIMIT 1",
        [appId],
      );
      if (!exists) {
        const row = await appDb.getFirstAsync<Record<string, any>>(
          "SELECT * FROM exercises WHERE exercise_id = ? LIMIT 1",
          [appId],
        );
        if (row) {
          await userDb.runAsync(
            `INSERT INTO exercises (app_exercise_id, name, image, local_animated_uri, animated_url, equipment, body_part, target_muscle, secondary_muscles, description, is_deleted, tracking_type, is_unilateral, double_weight)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.exercise_id,
              row.name,
              row.image ?? null,
              row.local_animated_uri ?? null,
              row.animated_url ?? null,
              row.equipment ?? null,
              row.body_part ?? null,
              row.target_muscle ?? null,
              row.secondary_muscles ?? null,
              row.description ?? null,
              row.is_deleted ?? 0,
              row.tracking_type ?? null,
              row.is_unilateral ?? null,
              row.double_weight ?? null,
            ],
          );
        } else {
          console.warn(
            `Exercise with app_exercise_id=${appId} not found in ${APP_DATA_DB}`,
          );
        }
      }
    }
  } finally {
    await appDb.closeAsync();
  }
};

const insertPlans = async (db: SQLiteDatabase, plans: Plan[]) => {
  const plansToInsert: Plan[] = [];

  for (const plan of plans) {
    // Step 1: Check if the plan with the given app_plan_id already exists
    const planExistsResult = (await db.getFirstAsync(
      "SELECT * FROM user_plans WHERE app_plan_id = ? LIMIT 1",
      [Number(plan.app_plan_id)],
    )) as any;

    if (!planExistsResult) {
      plansToInsert.push(plan);
    }
  }
  // Start the transaction
  await db.withExclusiveTransactionAsync(async (txn) => {
    try {
      for (const plan of plansToInsert) {
        // Step 2: Insert the plan into user_plans
        const planInsertResult = await txn.runAsync(
          "INSERT INTO user_plans (app_plan_id, name, image_url, is_active, is_deleted) VALUES (?, ?, ?, ?, ?)",
          [
            plan.app_plan_id ?? null,
            plan.name,
            plan.image_url,
            plan.is_active ?? false,
            plan.is_deleted ?? false,
          ],
        );

        const planId = planInsertResult.lastInsertRowId;

        // Step 3: Insert each workout related to this plan into user_workouts
        let workoutOrder = 0;
        for (const workout of plan.workouts) {
          const workoutInsertResult = await txn.runAsync(
            "INSERT INTO user_workouts (plan_id, name, is_deleted, workout_order) VALUES (?, ?, ?, ?)",
            [planId, workout.name, workout.is_deleted ?? false, workoutOrder++],
          );

          const workoutId = workoutInsertResult.lastInsertRowId;

          // Step 4: Insert each exercise within this workout into user_workout_exercises
          for (const exercise of workout.exercises) {
            // Translate appData exercise_id to local userData exercise_id
            const localExercise = await txn.getFirstAsync<{
              exercise_id: number;
            }>(
              "SELECT exercise_id FROM exercises WHERE app_exercise_id = ? LIMIT 1",
              [exercise.exercise_id],
            );
            if (!localExercise) {
              throw new Error(
                `Exercise with app_exercise_id=${exercise.exercise_id} not found in userData.db (plan app_plan_id=${plan.app_plan_id})`,
              );
            }

            const setsJson = JSON.stringify(exercise.sets); // Convert sets array to JSON string

            await txn.runAsync(
              "INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, is_deleted) VALUES (?, ?, ?, ?, ?)",
              [
                workoutId,
                localExercise.exercise_id,
                setsJson,
                exercise.exercise_order ?? null,
                exercise.is_deleted ?? false,
              ],
            );
          }
        }
      }
    } catch (error) {
      console.error("Error inserting premade plan:", error);
      throw error;
    }
  });
};

// Plan files shipped after the library copy can reference exercises the
// device does not have yet, so those are copied in before the plans.
const insertPlanFiles = async (
  db: SQLiteDatabase,
  files: (Plan | Plan[])[],
  fileDone: () => void,
) => {
  const allAppExerciseIds = new Set<number>();
  for (const file of files) {
    const plansArray = Array.isArray(file) ? file : [file];
    for (const plan of plansArray) {
      for (const workout of plan.workouts) {
        for (const exercise of workout.exercises) {
          if (exercise.exercise_id != null) {
            allAppExerciseIds.add(exercise.exercise_id);
          }
        }
      }
    }
  }
  await ensureAppExercisesExist(db, Array.from(allAppExerciseIds));

  for (const file of files) {
    await insertPlans(db, Array.isArray(file) ? file : [file]);
    fileDone();
  }
};

const v3PlanFiles = () => [
  require("@/assets/data/beginner-growth.json"),
  require("@/assets/data/classic-5x5.json"),
  require("@/assets/data/2-day-full-body.json"),
];

/**
 * Loads the v1 and v2 plan files. Its progress total also counts the files
 * loadPremadePlansV3 will load later in the same run, so a first run fills
 * one bar; it returns how far it got for that step to carry on from.
 */
export const loadPremadePlans = async (
  onProgress?: ProgressCallback,
): Promise<{ done: number; total: number }> => {
  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db"); // Open the database
    let syncVersion = await getAppDataSyncVersion(db);

    // One step per plan file this run will load (10 on a fresh install). The
    // v3 files only count when this step loads something, so an install
    // already at v2 leaves the v3 step to report alone.
    const earlierFiles =
      (syncVersion < APP_DATA_SYNC.premadePlansV1 ? 2 : 0) +
      (syncVersion < APP_DATA_SYNC.premadePlansV2 ? 5 : 0);
    const totalFiles =
      earlierFiles > 0 && syncVersion < APP_DATA_SYNC.premadePlansV3
        ? earlierFiles + v3PlanFiles().length
        : earlierFiles;
    let filesDone = 0;
    const fileDone = () => onProgress?.(++filesDone, totalFiles);
    if (totalFiles > 0) onProgress?.(0, totalFiles);

    if (syncVersion < APP_DATA_SYNC.premadePlansV1) {
      const plan1 = require("@/assets/data/3-day-full-body.json");
      const plan2 = require("@/assets/data/4-day-split.json");
      const planFiles = [plan1, plan2];
      for (const file of planFiles) {
        const plansArray = Array.isArray(file) ? file : [file];
        await insertPlans(db, plansArray);
        fileDone();
      }

      await setAppDataSyncVersion(db, APP_DATA_SYNC.premadePlansV1);
      Bugsnag.leaveBreadcrumb("Premade plans v1 loaded");
      syncVersion = APP_DATA_SYNC.premadePlansV1;
    }

    if (syncVersion < APP_DATA_SYNC.premadePlansV2) {
      await insertPlanFiles(
        db,
        [
          require("@/assets/data/5-day-bro-split.json"),
          require("@/assets/data/5-day-ppl.json"),
          require("@/assets/data/6-day-split.json"),
          require("@/assets/data/body-weight.json"),
          require("@/assets/data/dumbbell-only.json"),
        ],
        fileDone,
      );

      await setAppDataSyncVersion(db, APP_DATA_SYNC.premadePlansV2);
      Bugsnag.leaveBreadcrumb("Premade plans v2 loaded");
    }
    return { done: filesDone, total: totalFiles };
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error loading or inserting premade plans:", error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

/**
 * Premade plans added after the library refresh. A step of its own because
 * its sync version is above libraryRefreshed: run from loadPremadePlans, it
 * would advance an older install past the refresh and the flag resync.
 */
export const loadPremadePlansV3 = async (
  onProgress?: ProgressCallback,
  // Where loadPremadePlans left the bar, when it reported this run.
  progressFrom: { done: number; total: number } = { done: 0, total: 0 },
) => {
  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    if ((await getAppDataSyncVersion(db)) >= APP_DATA_SYNC.premadePlansV3) {
      return;
    }

    const files = v3PlanFiles();
    const total = progressFrom.total || files.length;
    let filesDone = progressFrom.done;
    if (!progressFrom.total) onProgress?.(0, total);
    await insertPlanFiles(db, files, () => onProgress?.(++filesDone, total));

    await setAppDataSyncVersion(db, APP_DATA_SYNC.premadePlansV3);
    Bugsnag.leaveBreadcrumb("Premade plans v3 loaded");
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error loading or inserting premade plans:", error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};
