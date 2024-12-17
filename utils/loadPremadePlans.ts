import { Plan } from "@/hooks/useAllPlansQuery";
import { openDatabase } from "./database";
import { SQLiteDatabase } from "expo-sqlite";
import Bugsnag from "@bugsnag/expo";

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
        for (const workout of plan.workouts) {
          const workoutInsertResult = await txn.runAsync(
            "INSERT INTO user_workouts (plan_id, name, is_deleted) VALUES (?, ?, ?)",
            [planId, workout.name, workout.is_deleted ?? false],
          );

          const workoutId = workoutInsertResult.lastInsertRowId;

          // Step 4: Insert each exercise within this workout into user_workout_exercises
          for (const exercise of workout.exercises) {
            const setsJson = JSON.stringify(exercise.sets); // Convert sets array to JSON string

            await txn.runAsync(
              "INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, is_deleted) VALUES (?, ?, ?, ?, ?)",
              [
                workoutId,
                exercise.exercise_id,
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
    dataVersion = Number(versionResult?.value);

    if (dataVersion === null || dataVersion < 1.8) {
      const data = require("@/assets/data/3-day-full-body.json");
      const plansArray = Array.isArray(data) ? data : [data];

      // Insert the plans into the database
      await insertPlans(db, plansArray);
    }
    if (dataVersion === null || dataVersion < 1.8) {
      const data = require("@/assets/data/4-day-split.json");
      const plansArray = Array.isArray(data) ? data : [data];

      // Insert the plans into the database
      await insertPlans(db, plansArray);

      console.log("Updating data version to 1.8...");
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ["dataVersion", "1.8"],
      );
    }
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error loading or inserting premade plans:", error);
    throw error;
  }
};
