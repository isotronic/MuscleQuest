import { Plan } from "@/hooks/useAllPlansQuery";
import { openDatabase } from "./database";
import { SQLiteDatabase } from "expo-sqlite";
import Bugsnag from "@bugsnag/expo";

const ensureAppExercisesExist = async (
  userDb: SQLiteDatabase,
  appExerciseIds: number[],
): Promise<void> => {
  const appDb = await openDatabase("appData3.db");
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
        console.log(`Copied exercise app_exercise_id=${appId} to userData.db`);
      } else {
        console.warn(
          `Exercise with app_exercise_id=${appId} not found in appData3.db`,
        );
      }
    }
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

    if (planExistsResult) {
      console.log(
        `Plan with app_plan_id ${plan.app_plan_id} already exists. Skipping insertion.`,
      );
    } else {
      plansToInsert.push(plan);
      console.log(
        `Plan with app_plan_id ${plan.app_plan_id} does not exist. Inserting...`,
      );
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
              console.warn(
                `Exercise with app_exercise_id=${exercise.exercise_id} not found in userData.db, skipping.`,
              );
              continue;
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

export const loadPremadePlans = async () => {
  let dataVersion: number | null = null;
  try {
    const db = await openDatabase("userData.db"); // Open the database
    const versionResult = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      ["dataVersion"],
    );
    dataVersion = versionResult ? Number(versionResult.value) : null;

    if (dataVersion === null || dataVersion < 1.8) {
      console.log("Condition met: Updating data version...");
      const plan1 = require("@/assets/data/3-day-full-body.json");
      const plan2 = require("@/assets/data/4-day-split.json");
      const planFiles = [plan1, plan2];
      for (const file of planFiles) {
        const plansArray = Array.isArray(file) ? file : [file];
        await insertPlans(db, plansArray);
      }

      console.log("Updating data version to 1.8...");
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ["dataVersion", "1.8"],
      );
      dataVersion = 1.8;
    }

    if ((dataVersion ?? 0) < 2.1) {
      console.log("Loading new premade plans (v2.1)...");
      const newPlanFiles = [
        require("@/assets/data/5-day-bro-split.json"),
        require("@/assets/data/5-day-ppl.json"),
        require("@/assets/data/6-day-split.json"),
        require("@/assets/data/body-weight.json"),
        require("@/assets/data/dumbbell-only.json"),
      ];

      // Collect all unique appData exercise IDs referenced in these plans
      const allAppExerciseIds = new Set<number>();
      for (const file of newPlanFiles) {
        const plansArray: Plan[] = Array.isArray(file) ? file : [file];
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

      // Ensure all referenced exercises exist in userData.db
      await ensureAppExercisesExist(db, Array.from(allAppExerciseIds));

      for (const file of newPlanFiles) {
        const plansArray = Array.isArray(file) ? file : [file];
        await insertPlans(db, plansArray);
      }

      console.log("Updating data version to 2.1...");
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ["dataVersion", "2.1"],
      );
    }
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error loading or inserting premade plans:", error);
    throw error;
  }
};
