import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { UserExercise, Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import * as SQLite from "expo-sqlite";
import {
  toDisplayValue,
  type ValueKind,
  type MeasurementDisplayOptions,
} from "@/utils/measurementConversions";
import {
  ExerciseFeedback,
  ExerciseFeedbackPayload,
  ExerciseProgressionState,
  ProgressionAction,
  ProgressionRuleResult,
  RecoveryRating,
  UserProgressionIncrements,
} from "@/types/progression";

export interface Exercise {
  exercise_id: number;
  app_exercise_id?: number;
  name: string;
  image: number[];
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

export interface SavedWorkout {
  planId: number | null;
  workoutId: number | null;
  duration: number;
  totalSetsCompleted: number;
  isDeload?: boolean;
  exercises: {
    exercise_id: number;
    resolved_tracking_type?: string | null;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup?: boolean;
      is_drop_set?: boolean;
      is_to_failure?: boolean;
      set_duration?: number | null;
    }[];
  }[];
}

export const openDatabase = async (
  databaseName: string,
): Promise<SQLite.SQLiteDatabase> => {
  return await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });
};

interface SQLiteRow {
  [key: string]: any;
}
interface SettingsEntry {
  value: string;
}

export const updateAppExerciseIds = async (): Promise<void> => {
  const userDataDB = await openDatabase("userData.db");
  try {
    // Check the current dataVersion
    const versionResult = await userDataDB.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      ["dataVersion"],
    );

    const dataVersion = versionResult?.value;

    if (dataVersion === "1.1") {
      console.log(
        "Data version is 1.1. Updating app_exercise_id for exercises...",
      );

      // Find all exercises where app_exercise_id is NULL
      const nullAppExerciseIds: SQLiteRow[] = await userDataDB.getAllAsync(
        `SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND exercise_id BETWEEN 0 AND 779`,
      );

      if (nullAppExerciseIds.length > 0) {
        await userDataDB.execAsync("BEGIN TRANSACTION");

        for (const row of nullAppExerciseIds) {
          // Set the app_exercise_id to the value of exercise_id
          await userDataDB.runAsync(
            `UPDATE exercises SET app_exercise_id = ? WHERE exercise_id = ?`,
            [row.exercise_id, row.exercise_id],
          );
        }

        await userDataDB.execAsync("COMMIT");

        console.log(`Updated ${nullAppExerciseIds.length} exercises.`);

        await userDataDB.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["dataVersion", "1.2"],
        );
        console.log("Updated data version to 1.2...");
      } else {
        console.log("No exercises with NULL app_exercise_id found.");
        await userDataDB.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["dataVersion", "1.2"],
        );
        console.log("Updated data version to 1.2...");
      }
    } else {
      console.log("Data version is not 1.1. No update needed.");
    }
  } catch (error: any) {
    console.error("Error updating app_exercise_id:", error);
    Bugsnag.notify(error);
    await userDataDB.execAsync("ROLLBACK");
  }
};

export const copyDataFromAppDataToUserData = async (): Promise<void> => {
  const appDataDB = await openDatabase("appData3.db");
  const userDataDB = await openDatabase("userData.db");

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

  const dataVersionEntry: SettingsEntry | null =
    await userDataDB.getFirstAsync<SettingsEntry>(
      "SELECT value FROM settings WHERE key = 'dataVersion'",
    );

  const dataVersion = Number(dataVersionEntry?.value) || null;

  if (dataVersion && dataVersion >= 1.7) {
    console.log("Data has already been copied.");
    return;
  }

  let shouldUpdateDataVersion = false;

  const copyTableData = async (
    tableName: string,
    columns: string[],
    excludeId: boolean = false,
  ): Promise<void> => {
    try {
      const result: SQLiteRow[] = await appDataDB.getAllAsync(
        `SELECT ${columns.join(", ")} FROM ${tableName}`,
      );

      console.log(`Copying ${result.length} rows into ${tableName}`);

      if (result.length > 0) {
        await userDataDB.execAsync("BEGIN TRANSACTION");

        const insertColumns = excludeId
          ? columns.filter((col) => col !== "exercise_id")
          : columns;

        if (tableName === "exercises") {
          insertColumns.push("app_exercise_id");
        }

        const placeholders = insertColumns.map(() => "?").join(", ");
        const insertStatement = `INSERT INTO ${tableName} (${insertColumns.join(", ")}) VALUES (${placeholders})`;

        const updateColumns = insertColumns.filter(
          (col) => col !== "exercise_id",
        );
        const updatePlaceholders = updateColumns
          .map((col) => `${col} = ?`)
          .join(", ");
        const updateStatement = `UPDATE ${tableName} SET ${updatePlaceholders} WHERE app_exercise_id = ?`;

        for (const row of result) {
          let shouldInsertOrUpdate = true;

          if (["muscles", "equipment_list", "body_parts"].includes(tableName)) {
            // Define unique column for each of these tables
            const uniqueColumn =
              tableName === "muscles"
                ? "muscle"
                : tableName === "equipment_list"
                  ? "equipment"
                  : "body_part";

            const existingEntry = await userDataDB.getFirstAsync(
              `SELECT * FROM ${tableName} WHERE ${uniqueColumn} = ? LIMIT 1`,
              [row[uniqueColumn]],
            );

            // Skip insertion if entry already exists
            if (existingEntry) {
              shouldInsertOrUpdate = false;
            }
          } else if (tableName === "exercises") {
            const existingEntry =
              await userDataDB.getFirstAsync<ExerciseCheckResult>(
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
                console.log(
                  `Updating exercise: ${row["name"]} with changed fields: ${fieldsToUpdate.join(", ")}`,
                );
                const values = updateColumns.map((col) => row[col]);
                values.push(row["exercise_id"]);
                await userDataDB.runAsync(updateStatement, values);
              }

              shouldInsertOrUpdate = false;
            }
          }

          if (shouldInsertOrUpdate) {
            const values = insertColumns.map((col) =>
              col === "app_exercise_id" ? row["exercise_id"] : row[col],
            );
            await userDataDB.runAsync(insertStatement, values);
          }
        }

        await userDataDB.execAsync("COMMIT");
      }
      shouldUpdateDataVersion = true;
    } catch (error: any) {
      console.error(`Error copying table ${tableName}:`, error);
      Bugsnag.notify(error);
      await userDataDB.execAsync("ROLLBACK");
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
    console.log("Updating data version to 1.7...");
    await userDataDB.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["dataVersion", "1.7"],
    );

    console.log("Data copy completed and version updated.");
  }
};

export const syncExerciseFlagsFromAppData = async (): Promise<void> => {
  const userDataDB = await openDatabase("userData.db");
  const versionResult = await userDataDB.getFirstAsync<SettingsEntry>(
    "SELECT value FROM settings WHERE key = 'dataVersion'",
  );
  if (Number(versionResult?.value) >= 2.0) return;

  const appDataDB = await openDatabase("appData3.db");
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
    await userDataDB.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["dataVersion", "2.0"],
    );
    await userDataDB.execAsync("COMMIT");
  } catch (err) {
    await userDataDB.execAsync("ROLLBACK");
    Bugsnag.notify(err as Error);
  }
};

export const fetchAllRecords = async (
  databaseName: string,
  tableName: string,
) => {
  const db = await openDatabase(databaseName);
  const allowedTables = [
    "user_plans",
    "exercises",
    "muscles",
    "body_parts",
    "equipment_list",
  ];
  if (!allowedTables.includes(tableName)) {
    Bugsnag.notify(new Error("Invalid table name"));
    throw new Error("Invalid table name");
  }

  // Check if the table contains an is_deleted field
  const tableInfo = await db.getAllAsync(`PRAGMA table_info(${tableName});`);
  const hasIsDeletedField = tableInfo.some(
    (column: any) => column.name === "is_deleted",
  );

  // Build the query accordingly
  const query = hasIsDeletedField
    ? `SELECT * FROM ${tableName} WHERE is_deleted = FALSE`
    : `SELECT * FROM ${tableName}`;

  return await db.getAllAsync(query);
};

export const fetchRecord = async (
  databaseName: string,
  tableName: string,
  id: number,
) => {
  const db = await openDatabase(databaseName);
  const allowedTables = [
    "user_plans",
    "exercises",
    "muscles",
    "body_parts",
    "equipment_list",
  ];
  if (!allowedTables.includes(tableName)) {
    Bugsnag.notify(new Error("Invalid table name"));
    throw new Error("Invalid table name");
  }
  const fieldName = tableName === "exercises" ? "exercise_id" : "id";
  try {
    return await db.getFirstAsync(
      `SELECT * FROM ${tableName} WHERE ${fieldName} = ?`,
      [id],
    );
  } catch (error: any) {
    console.error("Error fetching record:", error);
    Bugsnag.notify(error);
    throw new Error("Error fetching record");
  }
};

export const fetchMusclesByFilters = async (
  bodyPart: string | null,
  equipment: string | null,
) => {
  const db = await openDatabase("userData.db");
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
};

export const insertAnimatedImageUri = async (
  exercise_id: number,
  local_animated_uri: string,
) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(
    `UPDATE exercises SET local_animated_uri = ? WHERE exercise_id = ?`,
    [local_animated_uri, exercise_id],
  );
};

export const insertAnimatedImageUris = async (
  uris: { exercise_id: number; local_animated_uri: string }[],
) => {
  if (uris.length === 0) return;
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const { exercise_id, local_animated_uri } of uris) {
      await txn.runAsync(
        `UPDATE exercises SET local_animated_uri = ? WHERE exercise_id = ?`,
        [local_animated_uri, exercise_id],
      );
    }
  });
};

export interface ExerciseWithoutLocalAnimatedUriRow {
  exercise_id: number;
  animated_url: string;
}

export const fetchExercisesWithoutLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  return (await db.getAllAsync(
    `SELECT exercise_id, animated_url FROM exercises WHERE animated_url IS NOT NULL AND animated_url != '' AND (local_animated_uri IS NULL OR local_animated_uri = '')`,
  )) as ExerciseWithoutLocalAnimatedUriRow[];
};

export interface ExerciseWithLocalAnimatedUriRow {
  exercise_id: number;
  local_animated_uri: string;
}

export const fetchExercisesWithLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  return (await db.getAllAsync(
    `SELECT exercise_id, local_animated_uri FROM exercises WHERE local_animated_uri IS NOT NULL AND local_animated_uri != ''`,
  )) as ExerciseWithLocalAnimatedUriRow[];
};

export const clearAllLocalAnimatedUri = async () => {
  const db = await openDatabase("userData.db");
  await db.runAsync(`UPDATE exercises SET local_animated_uri = NULL`);
};

export const fetchActivePlan = async () => {
  const db = await openDatabase("userData.db");
  return await db.getFirstAsync(
    `SELECT * FROM user_plans WHERE is_active = true`,
  );
};

export const updateActivePlan = async (id: number) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(
    `UPDATE user_plans SET is_active = false WHERE is_active = true`,
  );
  await db.runAsync(`UPDATE user_plans SET is_active = true WHERE id = ?`, [
    id,
  ]);
};

export const insertWorkoutPlan = async (
  name: string,
  image_url: string,
  workouts: Workout[],
): Promise<number | null> => {
  const db = await openDatabase("userData.db"); // Open database once
  let newPlanId: number | null = null;

  // Start the transaction
  await db.withExclusiveTransactionAsync(async (txn) => {
    try {
      // Insert the plan
      const result = await txn.runAsync(
        `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
        [name, image_url],
      );

      newPlanId = result.lastInsertRowId;

      // Insert the workouts associated with this plan
      await insertWorkouts(txn, newPlanId, workouts);
    } catch (error: any) {
      console.error("Error inserting workout plan:", error);
      Bugsnag.notify(error);
      throw error;
    }
  });

  return newPlanId;
};

export const insertWorkouts = async (
  txn: SQLite.SQLiteDatabase, // Pass transaction to avoid nested transactions
  planId: number,
  workouts: Workout[],
) => {
  try {
    for (const [workoutOrder, workout] of workouts.entries()) {
      const { exercises, name } = workout;
      const workoutName = name || `Workout ${workoutOrder + 1}`;

      // Insert the workout and get the inserted workout ID
      const result = await txn.runAsync(
        `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
        [planId, workoutName, workoutOrder],
      );

      const workoutId = result.lastInsertRowId;

      // Insert exercises related to this workout
      for (const [exerciseOrder, exercise] of exercises.entries()) {
        const { exercise_id, sets } = exercise;

        // Insert into user_workout_exercises
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (
            workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise_id,
            JSON.stringify(sets),
            exerciseOrder,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    }
  } catch (error: any) {
    console.error("Error inserting workouts:", error);
    Bugsnag.notify(error);
    throw error; // Re-throw the error to trigger transaction rollback
  }
};

export const updateWorkoutPlan = async (
  id: number,
  name: string,
  image_url: string,
  workouts: Workout[],
) => {
  const db = await openDatabase("userData.db");

  // Start the transaction for the entire update process
  await db.withExclusiveTransactionAsync(async (txn) => {
    try {
      // Update the workout plan details
      await txn.runAsync(
        `UPDATE user_plans SET name = ?, image_url = ? WHERE id = ?`,
        [name, image_url, id],
      );

      // Fetch existing workouts for the plan
      const existingWorkouts: { id: number }[] = await txn.getAllAsync(
        `SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE`,
        [id],
      );

      // Find and mark workouts for deletion that are not in the new workout list
      const workoutIdsToKeep = workouts.map((w) => w.id).filter(Boolean); // Filter out new workouts (no ID)
      const workoutsToDelete = existingWorkouts.filter(
        (w) => !workoutIdsToKeep.includes(w.id),
      );

      for (const workout of workoutsToDelete) {
        await txn.runAsync(
          `UPDATE user_workouts SET is_deleted = TRUE WHERE id = ?`,
          [workout.id],
        );
        await txn.runAsync(
          `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE workout_id = ?`,
          [workout.id],
        );
      }

      // Iterate through new or updated workouts
      for (const [workoutOrder, workout] of workouts.entries()) {
        let workoutId = workout.id;
        const workoutName = workout.name || `Workout ${workoutOrder + 1}`;

        if (!workoutId || workoutId < 0) {
          // Insert new workout (workoutId is null/undefined for brand-new workouts,
          // or negative (temp ID like -Date.now()) for workouts added during plan editing)
          const result = await txn.runAsync(
            `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
            [id, workoutName, workoutOrder],
          );
          workoutId = result.lastInsertRowId;
        } else {
          // Update existing workout name and order
          await txn.runAsync(
            `UPDATE user_workouts SET name = ?, workout_order = ? WHERE id = ?`,
            [workoutName, workoutOrder, workoutId],
          );
        }

        // Fetch existing exercises for the workout
        const existingExercises: { id: number; exercise_id: number }[] =
          await txn.getAllAsync(
            `SELECT id, exercise_id FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
            [workoutId],
          );
        const existingExerciseIds = existingExercises.map((e) => e.exercise_id);

        // Find and mark exercises for deletion that are not in the updated workout
        const exerciseIdsToKeep = workout.exercises.map((e) => e.exercise_id);
        const exercisesToDelete = existingExercises.filter(
          (e) => !exerciseIdsToKeep.includes(e.exercise_id),
        );

        for (const exercise of exercisesToDelete) {
          await txn.runAsync(
            `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE id = ?`,
            [exercise.id],
          );
        }

        // Insert or update exercises and sets
        for (const [exerciseOrder, exercise] of workout.exercises.entries()) {
          if (!existingExerciseIds.includes(exercise.exercise_id)) {
            // Insert new exercise
            await txn.runAsync(
              `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                workoutId,
                exercise.exercise_id,
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId ?? null,
                exercise.tracking_type_override ?? null,
              ],
            );
          } else {
            // Update existing exercise
            await txn.runAsync(
              `UPDATE user_workout_exercises SET sets = ?, exercise_order = ?, superset_group_id = ?, tracking_type_override = ? WHERE workout_id = ? AND exercise_id = ?`,
              [
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId ?? null,
                exercise.tracking_type_override ?? null,
                workoutId,
                exercise.exercise_id,
              ],
            );
          }
        }
      }
    } catch (error: any) {
      console.error("Error updating workout plan:", error);
      Bugsnag.notify(error);
      throw error;
    }
  });
};

export const appendExercisesToWorkout = async (
  workoutId: number,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row: { maxOrder: number } | null = await txn.getFirstAsync(
      `SELECT COALESCE(MAX(exercise_order), -1) as maxOrder FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
      [workoutId],
    );
    const baseOrder = (row?.maxOrder ?? -1) + 1;
    for (const [i, exercise] of exercises.entries()) {
      await txn.runAsync(
        `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          workoutId,
          exercise.exercise_id,
          JSON.stringify(exercise.sets),
          baseOrder + i,
          exercise.supersetGroupId ?? null,
          exercise.tracking_type_override ?? null,
        ],
      );
    }
  });
};

export const updatePlanWorkoutExercises = async (
  workoutId: number,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing: {
      id: number;
      exercise_id: number;
      exercise_order: number;
    }[] = await txn.getAllAsync(
      `SELECT id, exercise_id, exercise_order FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
      [workoutId],
    );
    const existingByOrder = new Map(existing.map((e) => [e.exercise_order, e]));
    const incomingOrders = new Set(exercises.map((_, i) => i));

    for (const row of existing) {
      if (!incomingOrders.has(row.exercise_order)) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE id = ?`,
          [row.id],
        );
      }
    }

    for (const [order, exercise] of exercises.entries()) {
      const existingRow = existingByOrder.get(order);
      if (existingRow) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET exercise_id = ?, sets = ?, exercise_order = ?, superset_group_id = ?, tracking_type_override = ?, is_deleted = FALSE WHERE id = ?`,
          [
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
            existingRow.id,
          ],
        );
      } else {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    }
  });
};

export const deleteWorkoutPlan = async (planId: number) => {
  const db = await openDatabase("userData.db");

  // Start an exclusive transaction to ensure that all updates are executed together
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Mark exercises associated with workouts under the plan as deleted
    await txn.runAsync(
      `UPDATE user_workout_exercises 
       SET is_deleted = TRUE 
       WHERE workout_id IN (
         SELECT id FROM user_workouts WHERE plan_id = ?
       )`,
      [planId],
    );

    // Mark workouts associated with the plan as deleted
    await txn.runAsync(
      `UPDATE user_workouts 
       SET is_deleted = TRUE 
       WHERE plan_id = ?`,
      [planId],
    );

    // Finally, mark the plan itself as deleted
    await txn.runAsync(
      `UPDATE user_plans 
       SET is_deleted = TRUE 
       WHERE id = ?`,
      [planId],
    );
  });
};

export const saveCompletedWorkout = async (
  planId: number | null,
  workoutId: number | null,
  duration: number,
  totalSetsCompleted: number,
  isDeload: boolean = false,
  exercises: {
    exercise_id: number;
    resolved_tracking_type?: string | null;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup?: boolean;
      is_drop_set?: boolean;
      is_to_failure?: boolean;
      set_duration?: number | null;
    }[];
  }[],
) => {
  const db = await openDatabase("userData.db");

  try {
    // Begin transaction
    await db.execAsync("BEGIN TRANSACTION");

    // Insert the completed workout
    const completedWorkoutResult = await db.runAsync(
      `INSERT INTO completed_workouts (plan_id, workout_id, date_completed, duration, total_sets_completed, is_deload) VALUES (?, ?, datetime('now'), ?, ?, ?)`,
      [planId, workoutId, duration, totalSetsCompleted, isDeload ? 1 : 0],
    );

    const completedWorkoutId = completedWorkoutResult.lastInsertRowId;

    for (const exercise of exercises) {
      // Insert each completed exercise
      const completedExerciseResult = await db.runAsync(
        `INSERT INTO completed_exercises (completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?)`,
        [
          completedWorkoutId,
          exercise.exercise_id,
          exercise.resolved_tracking_type ?? null,
        ],
      );

      const completedExerciseId = completedExerciseResult.lastInsertRowId;

      for (const set of exercise.sets) {
        // Insert each completed set
        await db.runAsync(
          `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, time, distance, is_warmup, is_drop_set, is_to_failure, set_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            completedExerciseId,
            set.set_number,
            set.weight,
            set.reps,
            set.time,
            set.distance,
            set.is_warmup ? 1 : 0,
            set.is_drop_set ? 1 : 0,
            set.is_to_failure ? 1 : 0,
            set.set_duration ?? null,
          ],
        );
      }
    }

    // Commit transaction
    await db.execAsync("COMMIT");
    return completedWorkoutId;
  } catch (error: any) {
    // Rollback transaction
    try {
      await db.execAsync("ROLLBACK");
      console.error("Transaction rolled back due to error.");
    } catch (rollbackError: any) {
      Bugsnag.notify(rollbackError);
      console.error("Error during rollback: ", rollbackError);
    }

    // Log and re-throw the original error
    console.error("Error saving completed workout: ", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const linkCompletedWorkoutToWorkout = async (
  completedWorkoutId: number,
  workoutId: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE completed_workouts SET workout_id = ? WHERE id = ?`,
      [workoutId, completedWorkoutId],
    );
  } catch (error) {
    console.error(
      `Error linking completed workout ${completedWorkoutId} to workout ${workoutId}:`,
      error,
    );
    Bugsnag.notify(error as Error);
    throw error;
  }
};

interface CompletedWorkoutRow {
  id: number;
  plan_id: number;
  workout_id: number;
  workout_name: string;
  is_deload: number;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number | null;
  exercise_name: string | null;
  exercise_image: Uint8Array | null;
  exercise_order: number;
  exercise_tracking_type: string | null;
  is_unilateral: number | null;
  double_weight: number | null;
  set_id: number;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: number | null;
  set_duration: number | null;
}

export const fetchCompletedWorkoutById = async (
  id: number,
  weightUnit: string = "kg",
  distanceUnit: string = "m",
): Promise<CompletedWorkout> => {
  const db = await openDatabase("userData.db");

  try {
    const result = (await db.getAllAsync(
      `
      SELECT 
        cw.id,
        cw.plan_id as plan_id,
        cw.workout_id as workout_id,
        COALESCE(uw.name, 'Quick Workout') as workout_name,
        cw.date_completed,
        cw.duration,
        cw.total_sets_completed,
        cw.is_deload,
        e.exercise_id as exercise_id, 
        e.name as exercise_name, 
        e.image as exercise_image, 
        COALESCE(ce.resolved_tracking_type, uwe.tracking_type_override, e.tracking_type) as exercise_tracking_type,
        e.is_unilateral,
        e.double_weight,
        cs.id as set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration,
        uwe.exercise_order -- Include exercise order from user_workout_exercises
      FROM completed_workouts cw
      LEFT JOIN completed_exercises ce ON cw.id = ce.completed_workout_id
      LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id -- Join exercises table for exercise details
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id AND uwe.exercise_id = ce.exercise_id -- Join user_workout_exercises to get exercise order
      WHERE cw.id = ?
      ORDER BY uwe.exercise_order, cs.set_number; -- Order by exercise_order and then set_number
      `,
      [id],
    )) as CompletedWorkoutRow[];

    if (!result || result.length === 0) {
      throw new Error("No workout found with the provided workoutId.");
    }

    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

    // Initialize the completed workout object
    const workout: CompletedWorkout = {
      id: result[0].id,
      workout_id: result[0].workout_id,
      plan_id: result[0].plan_id,
      workout_name: result[0]?.workout_name || "",
      date_completed: result[0]?.date_completed || "",
      duration: result[0]?.duration || 0,
      total_sets_completed: result[0]?.total_sets_completed || 0,
      is_deload: result[0]?.is_deload ?? 0,
      exercises: [],
    };

    // Temporary map to store exercises with their order
    const exercisesMap: {
      [exercise_id: number]: CompletedWorkout["exercises"][0] & {
        exercise_order: number;
        exercise_tracking_type: string;
      };
    } = {};

    result.forEach((row) => {
      if (row.exercise_id) {
        if (!exercisesMap[row.exercise_id]) {
          exercisesMap[row.exercise_id] = {
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name || "",
            exercise_image: row.exercise_image
              ? Array.from(row.exercise_image)
              : undefined,
            exercise_tracking_type: row.exercise_tracking_type || "weight",
            is_unilateral: row.is_unilateral ?? 0,
            double_weight: row.double_weight ?? 0,
            sets: [],
            exercise_order: row.exercise_order, // Track exercise order
          };
        }

        if (row.set_number !== null && row.set_id !== null) {
          const alreadySeen = exercisesMap[row.exercise_id].sets.some(
            (s) => s.set_id === row.set_id,
          );
          if (!alreadySeen) {
            // Convert weight from kg to the user's unit
            const weightInKg = parseFloat(row.weight?.toString() || "0");
            const convertedWeight = parseFloat(
              (weightInKg * conversionFactor).toFixed(1),
            );

            const distanceInMeters = parseFloat(
              row.distance?.toString() || "0",
            );
            const distanceConversionFactor =
              distanceUnit === "ft" ? 3.28084 : 1;
            const convertedDistance = parseFloat(
              (distanceInMeters * distanceConversionFactor).toFixed(2),
            );

            exercisesMap[row.exercise_id].sets.push({
              set_id: row.set_id,
              set_number: row.set_number,
              weight: Number.isFinite(convertedWeight) ? convertedWeight : null,
              reps: row.reps || null,
              time: row.time || null,
              distance:
                row.distance !== null && Number.isFinite(distanceInMeters)
                  ? convertedDistance
                  : null,
              is_warmup: !!row.is_warmup,
              set_duration: row.set_duration ?? null,
            });
          }
        }
      }
    });

    // Sort exercises by exercise_order and assign them to the workout's exercises
    workout.exercises = Object.values(exercisesMap)
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map(({ exercise_order, ...rest }) => rest); // Remove exercise_order from the final output

    return workout;
  } catch (error: any) {
    console.error("Error fetching completed workout by ID:", error);
    Bugsnag.notify(error);
    throw error;
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
    Bugsnag.notify(error);
    throw error;
  }
};

export const insertDefaultSettings = async () => {
  const db = await openDatabase("userData.db");

  const defaultSettings = [
    { key: "weeklyGoal", value: "3" },
    { key: "keepScreenOn", value: "false" },
    { key: "downloadImages", value: "false" },
    { key: "weightUnit", value: "kg" },
    { key: "distanceUnit", value: "m" },
    { key: "sizeUnit", value: "cm" },
    { key: "weightIncrement", value: "1" },
    { key: "defaultSets", value: "3" },
    { key: "defaultRestTime", value: "60" },
    { key: "buttonSize", value: "Standard" },
    { key: "timeRange", value: "30" },
    { key: "restTimerVibration", value: "false" },
    { key: "restTimerSound", value: "false" },
    { key: "restTimerNotification", value: "false" },
    { key: "restTimerIncrement", value: "15" },
    { key: "loginShown", value: "false" },
    { key: "showOnboarding", value: "true" },
    { key: "bodyWeight", value: "70" },
    { key: "timerCountdown", value: "5" },
    { key: "workoutReminderEnabled", value: "false" },
    { key: "workoutReminderDays", value: "[]" },
    { key: "workoutReminderTime", value: "08:00" },
    { key: "excludeWarmupSets", value: "false" },
    { key: "countUnilateralDouble", value: "false" },
    { key: "doubleWeightForPaired", value: "false" },
    { key: "timerCountdownSound", value: "false" },
    { key: "timerGoalSound", value: "false" },
    { key: "alwaysUseGlobalHistory", value: "false" },
    { key: "plansViewMode", value: "carousel" },
    { key: "adaptive_progression_enabled", value: "0" },
    { key: "progression_increment_barbell_kg", value: "2.5" },
    { key: "progression_increment_dumbbell_kg", value: "2.0" },
    { key: "progression_increment_cable_kg", value: "2.5" },
    { key: "progression_increment_machine_kg", value: "2.5" },
    { key: "exclude_deload_from_stats", value: "0" },
  ];

  // Loop through each default setting
  for (const setting of defaultSettings) {
    // Check if the setting already exists in the database
    const existingSetting = await db.getFirstAsync(
      "SELECT value FROM settings WHERE key = ?",
      [setting.key],
    );

    // If the setting doesn't exist, insert it
    if (!existingSetting) {
      await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?)", [
        setting.key,
        setting.value,
      ]);
    }
  }
};

interface SettingsResult {
  key: string;
  value: string;
}
export interface Settings {
  weeklyGoal: string;
  keepScreenOn: string;
  downloadImages: string;
  weightUnit: string;
  distanceUnit: string;
  sizeUnit: string;
  weightIncrement: string;
  defaultSets: string;
  defaultRestTime: string;
  buttonSize: string;
  timeRange: string;
  dataVersion: string;
  restTimerVibration: string;
  restTimerSound: string;
  restTimerNotification: string;
  restTimerIncrement: string;
  bodyWeight: string;
  loginShown: string;
  showOnboarding: string;
  lastSeenVersion: string;
  timerCountdown: string;
  workoutReminderEnabled: string;
  workoutReminderDays: string;
  workoutReminderTime: string;
  excludeWarmupSets: string;
  countUnilateralDouble: string;
  doubleWeightForPaired: string;
  timerCountdownSound: string;
  timerGoalSound: string;
  alwaysUseGlobalHistory: string;
  plansViewMode: string;
  adaptive_progression_enabled: string;
  progression_increment_barbell_kg: string;
  progression_increment_dumbbell_kg: string;
  progression_increment_cable_kg: string;
  progression_increment_machine_kg: string;
  exclude_deload_from_stats: string;
}

export const fetchSettings = async (): Promise<Settings> => {
  try {
    const db = await openDatabase("userData.db");

    const result = (await db.getAllAsync(
      "SELECT * FROM settings",
    )) as SettingsResult[];

    const settings: Partial<Settings> = {};

    result.forEach((row: { key: string; value: string }) => {
      settings[row.key as keyof Settings] = row.value;
    });

    // Convert bodyWeight to lbs if the unit setting is 'lbs'
    if (settings.bodyWeight && settings.weightUnit === "lbs") {
      settings.bodyWeight = (Number(settings.bodyWeight) * 2.2046226).toFixed(
        1,
      ); // Convert kg to lbs
    }

    return settings as Settings;
  } catch (error: any) {
    console.error("Database fetching error:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const updateSettings = async (key: string, value: string) => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [key, value],
    );
  } catch (error: any) {
    console.error("Error updating setting:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const saveNote = async (
  referenceId: number,
  secondaryReferenceId: number | null,
  note: string,
  noteType: string,
) => {
  try {
    const db = await openDatabase("userData.db");

    if (secondaryReferenceId == null) {
      // Insert/update where secondary_reference_id IS NULL
      await db.runAsync(
        `
        INSERT OR REPLACE INTO notes (
          id, note, type, reference_id, secondary_reference_id, created_at
        )
        VALUES (
          (SELECT id FROM notes
            WHERE type = ?
              AND reference_id = ?
              AND secondary_reference_id IS NULL
          ), -- preserve existing ID if it exists
          ?,  -- new note text
          ?,  -- type
          ?,  -- reference_id
          NULL,  -- secondary_reference_id is NULL
          CURRENT_TIMESTAMP
        );
        `,
        [noteType, referenceId, note, noteType, referenceId],
      );
    } else {
      // Insert/update using secondary_reference_id = ?
      await db.runAsync(
        `
        INSERT OR REPLACE INTO notes (
          id, note, type, reference_id, secondary_reference_id, created_at
        )
        VALUES (
          (SELECT id FROM notes
            WHERE type = ?
              AND reference_id = ?
              AND secondary_reference_id = ?
          ), -- preserve existing ID if it exists
          ?,  -- new note text
          ?,  -- type
          ?,  -- reference_id
          ?,  -- secondary_reference_id
          CURRENT_TIMESTAMP
        );
        `,
        [
          noteType,
          referenceId,
          secondaryReferenceId,
          note,
          noteType,
          referenceId,
          secondaryReferenceId,
        ],
      );
    }
  } catch (error: any) {
    console.error("Error saving note:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

interface RawStandaloneWorkout {
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  uwe_exercise_id: number | null;
  exercise_id: number | null;
  exercise_name: string | null;
  description: string | null;
  image: Uint8Array | null;
  local_animated_uri: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number | null;
  superset_group_id: string | null;
}

export const getStandaloneWorkouts = async (): Promise<Workout[]> => {
  const db = await openDatabase("userData.db");
  const rows = (await db.getAllAsync(`
    SELECT
      uw.id AS workout_id,
      uw.name AS workout_name,
      uw.image_url,
      uwe.id AS uwe_exercise_id,
      e.exercise_id,
      e.name AS exercise_name,
      e.description,
      e.image,
      e.local_animated_uri,
      e.animated_url,
      e.equipment,
      e.body_part,
      e.target_muscle,
      e.secondary_muscles,
      e.tracking_type,
      uwe.tracking_type_override,
      uwe.sets,
      uwe.exercise_order,
      uwe.superset_group_id
    FROM user_workouts uw
    LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
    LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
    WHERE uw.plan_id IS NULL AND uw.is_deleted = FALSE
    ORDER BY uw.id DESC, uwe.exercise_order ASC
  `)) as RawStandaloneWorkout[];

  const workoutsMap = new Map<number, Workout>();
  for (const row of rows) {
    let workout = workoutsMap.get(row.workout_id);
    if (!workout) {
      workout = {
        id: row.workout_id,
        name: row.workout_name,
        exercises: [],
      };
      workoutsMap.set(row.workout_id, workout);
    }
    if (row.exercise_id && row.exercise_name) {
      workout.exercises.push({
        exercise_id: row.exercise_id,
        name: row.exercise_name,
        description: row.description || "",
        image: row.image ? Array.from(row.image) : [],
        local_animated_uri: row.local_animated_uri || "",
        animated_url: row.animated_url || "",
        equipment: row.equipment || "",
        body_part: row.body_part || "",
        target_muscle: row.target_muscle || "",
        secondary_muscles: (() => {
          try {
            return row.secondary_muscles
              ? JSON.parse(row.secondary_muscles)
              : [];
          } catch (e: any) {
            Bugsnag.notify(e);
            return [];
          }
        })(),
        tracking_type: row.tracking_type ?? undefined,
        tracking_type_override: row.tracking_type_override ?? undefined,
        sets: (() => {
          try {
            return row.sets ? JSON.parse(row.sets) : [];
          } catch (e: any) {
            Bugsnag.notify(e);
            return [];
          }
        })(),
        supersetGroupId: row.superset_group_id ?? undefined,
      });
    }
  }
  return Array.from(workoutsMap.values());
};

export const createStandaloneWorkout = async (
  name: string,
  exercises: UserExercise[],
): Promise<number> => {
  const db = await openDatabase("userData.db");
  let newWorkoutId = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const result = await txn.runAsync(
      `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (NULL, ?, 0)`,
      [name],
    );
    newWorkoutId = result.lastInsertRowId;
    for (const [order, exercise] of exercises.entries()) {
      await txn.runAsync(
        `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newWorkoutId,
          exercise.exercise_id,
          JSON.stringify(exercise.sets),
          order,
          exercise.supersetGroupId ?? null,
          exercise.tracking_type_override ?? null,
        ],
      );
    }
  });
  return newWorkoutId;
};

export const updateStandaloneWorkout = async (
  workoutId: number,
  name: string,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`UPDATE user_workouts SET name = ? WHERE id = ?`, [
      name,
      workoutId,
    ]);

    const existing: {
      id: number;
      exercise_id: number;
      exercise_order: number;
    }[] = await txn.getAllAsync(
      `SELECT id, exercise_id, exercise_order FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
      [workoutId],
    );
    const existingByOrder = new Map(existing.map((e) => [e.exercise_order, e]));
    const incomingOrders = new Set(exercises.map((_, i) => i));

    // Soft-delete rows whose position no longer exists in the incoming list
    for (const row of existing) {
      if (!incomingOrders.has(row.exercise_order)) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE id = ?`,
          [row.id],
        );
      }
    }

    // Update by row id (keyed on position) or insert new rows
    for (const [order, exercise] of exercises.entries()) {
      const existingRow = existingByOrder.get(order);
      if (existingRow) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET exercise_id = ?, sets = ?, exercise_order = ?, superset_group_id = ?, tracking_type_override = ?, is_deleted = FALSE WHERE id = ?`,
          [
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
            existingRow.id,
          ],
        );
      } else {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    }
  });
};

export const deleteStandaloneWorkout = async (
  workoutId: number,
): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE workout_id = ?`,
      [workoutId],
    );
    await txn.runAsync(
      `UPDATE user_workouts SET is_deleted = TRUE WHERE id = ?`,
      [workoutId],
    );
  });
};

export const deleteCompletedWorkout = async (id: number): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE completed_sets SET is_deleted = TRUE
       WHERE completed_exercise_id IN (
         SELECT id FROM completed_exercises WHERE completed_workout_id = ?
       )`,
      [id],
    );
    await txn.runAsync(
      `UPDATE completed_exercises SET is_deleted = TRUE WHERE completed_workout_id = ?`,
      [id],
    );
    await txn.runAsync(
      `UPDATE completed_workouts SET is_deleted = TRUE WHERE id = ?`,
      [id],
    );
  });
};

// ---------- Plan Schedule ----------

export interface PlanScheduleEntry {
  day_of_week: number; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  workout_id: number;
}

export const fetchPlanSchedule = async (
  planId: number,
): Promise<PlanScheduleEntry[]> => {
  try {
    const db = await openDatabase("userData.db");
    return await db.getAllAsync<PlanScheduleEntry>(
      `SELECT day_of_week, workout_id FROM plan_schedule WHERE plan_id = ? ORDER BY day_of_week`,
      [planId],
    );
  } catch (error: any) {
    console.error("Error fetching plan schedule:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const savePlanSchedule = async (
  planId: number,
  entries: PlanScheduleEntry[],
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(`DELETE FROM plan_schedule WHERE plan_id = ?`, [
        planId,
      ]);
      for (const entry of entries) {
        await txn.runAsync(
          `INSERT INTO plan_schedule (plan_id, day_of_week, workout_id) VALUES (?, ?, ?)`,
          [planId, entry.day_of_week, entry.workout_id],
        );
      }
    });
  } catch (error) {
    console.error(`Error in savePlanSchedule for planId ${planId}:`, error);
    Bugsnag.notify(error as Error);
    throw error;
  }
};

// ---------- Notes ----------

export const fetchNote = async (
  referenceId: number,
  secondaryReferenceId: number | null,
  noteType: string,
) => {
  try {
    const db = await openDatabase("userData.db");

    let query = `
      SELECT note FROM notes 
      WHERE type = ? 
        AND reference_id = ? 
        AND secondary_reference_id = ?
    `;
    let params: (string | number | null)[] = [
      noteType,
      referenceId,
      secondaryReferenceId,
    ];

    // If secondaryReferenceId is null, we must use "IS NULL" instead of "= ?"
    if (secondaryReferenceId == null) {
      query = `
        SELECT note FROM notes 
        WHERE type = ? 
          AND reference_id = ? 
          AND secondary_reference_id IS NULL
      `;
      params = [noteType, referenceId];
    }

    const result = (await db.getFirstAsync(query, params)) as { note?: string };
    return result?.note || "";
  } catch (error: any) {
    console.error("Error fetching note:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export interface WeeklyCompletion {
  id: number;
  week_start: string;
  goal: number;
  completed: number;
  goal_reached: boolean;
}

export const getWeeklyCompletions = async (): Promise<WeeklyCompletion[]> => {
  try {
    const db = await openDatabase("userData.db");
    return (await db.getAllAsync(
      `SELECT * FROM weekly_completions ORDER BY week_start DESC`,
    )) as WeeklyCompletion[];
  } catch (error: any) {
    console.error("Error fetching weekly completions:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const upsertWeeklyCompletion = async (
  weekStart: string,
  goal: number,
  completed: number,
  goalReached: boolean,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT OR REPLACE INTO weekly_completions (week_start, goal, completed, goal_reached) VALUES (?, ?, ?, ?)`,
      [weekStart, goal, completed, goalReached ? 1 : 0],
    );
  } catch (error: any) {
    console.error("Error upserting weekly completion:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const fetchSetDurationsForExercises = async (
  exerciseIds: number[],
): Promise<Record<number, { duration: number; reps: number | null }[]>> => {
  if (exerciseIds.length === 0) return {};
  try {
    const db = await openDatabase("userData.db");
    const placeholders = exerciseIds.map(() => "?").join(", ");
    const rows = (await db.getAllAsync(
      `SELECT ce.exercise_id, cs.set_duration, cs.reps
       FROM completed_sets cs
       JOIN completed_exercises ce ON cs.completed_exercise_id = ce.id
       JOIN completed_workouts cw  ON ce.completed_workout_id  = cw.id
       WHERE ce.exercise_id IN (${placeholders})
         AND cs.set_duration > 0
         AND cs.is_deleted   = FALSE
         AND cw.is_deleted   = FALSE
       ORDER BY cw.date_completed DESC`,
      exerciseIds,
    )) as { exercise_id: number; set_duration: number; reps: number | null }[];

    const result: Record<number, { duration: number; reps: number | null }[]> =
      {};
    for (const row of rows) {
      if (!result[row.exercise_id]) {
        result[row.exercise_id] = [];
      }
      result[row.exercise_id].push({
        duration: row.set_duration,
        reps: row.reps,
      });
    }
    return result;
  } catch (error: any) {
    console.error("Error fetching set durations for exercises:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

// ─── Body Measurements ────────────────────────────────────────────────────────

export interface BodyMetricDefinition {
  id: number;
  key: string;
  label: string;
  value_kind: ValueKind;
  is_builtin: boolean;
  is_active: boolean;
  is_deleted: boolean;
  sort_order: number;
}

export interface BodyMeasurementEntry {
  id: number;
  recorded_at: string;
}

export interface BodyMeasurementSession {
  entry: BodyMeasurementEntry;
  values: {
    metric: BodyMetricDefinition;
    canonicalValue: number;
    displayValue: number;
    displayUnit: string;
  }[];
}

type RawMetricDefinitionRow = {
  id: number;
  key: string;
  label: string;
  value_kind: string;
  is_builtin: number;
  is_active: number;
  is_deleted: number;
  sort_order: number;
};

function rowToMetricDefinition(
  row: RawMetricDefinitionRow,
): BodyMetricDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value_kind: row.value_kind as ValueKind,
    is_builtin: row.is_builtin === 1,
    is_active: row.is_active === 1,
    is_deleted: row.is_deleted === 1,
    sort_order: row.sort_order,
  };
}

export const fetchActiveBodyMetricDefinitions = async (): Promise<
  BodyMetricDefinition[]
> => {
  try {
    const db = await openDatabase("userData.db");
    const rows = (await db.getAllAsync(
      `SELECT * FROM body_metric_definitions
       WHERE is_active = 1 AND is_deleted = 0
       ORDER BY sort_order ASC`,
    )) as RawMetricDefinitionRow[];
    return rows.map(rowToMetricDefinition);
  } catch (error: any) {
    console.error("Error fetching active body metric definitions:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const fetchAllBodyMetricDefinitions = async (): Promise<
  BodyMetricDefinition[]
> => {
  try {
    const db = await openDatabase("userData.db");
    const rows = (await db.getAllAsync(
      `SELECT * FROM body_metric_definitions
       WHERE is_deleted = 0
       ORDER BY is_builtin DESC, sort_order ASC`,
    )) as RawMetricDefinitionRow[];
    return rows.map(rowToMetricDefinition);
  } catch (error: any) {
    console.error("Error fetching all body metric definitions:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const insertCustomBodyMetricDefinition = async (
  label: string,
  value_kind: ValueKind,
): Promise<number> => {
  try {
    const db = await openDatabase("userData.db");
    const key =
      label.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "") +
      "_" +
      Date.now();
    const maxOrderRow = await db.getFirstAsync<{ max_order: number | null }>(
      `SELECT MAX(sort_order) AS max_order FROM body_metric_definitions WHERE is_deleted = 0`,
    );
    const sortOrder = (maxOrderRow?.max_order ?? 11) + 1;
    const result = await db.runAsync(
      `INSERT INTO body_metric_definitions (key, label, value_kind, is_builtin, is_active, is_deleted, sort_order)
       VALUES (?, ?, ?, 0, 1, 0, ?)`,
      [key, label, value_kind, sortOrder],
    );
    return result.lastInsertRowId;
  } catch (error: any) {
    console.error("Error inserting custom body metric definition:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const toggleBodyMetricActive = async (
  id: number,
  is_active: boolean,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE body_metric_definitions SET is_active = ? WHERE id = ?`,
      [is_active ? 1 : 0, id],
    );
  } catch (error: any) {
    console.error("Error toggling body metric active state:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const softDeleteCustomBodyMetricDefinition = async (
  id: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE body_metric_definitions SET is_deleted = 1, is_active = 0 WHERE id = ? AND is_builtin = 0`,
      [id],
    );
  } catch (error: any) {
    console.error("Error soft-deleting body metric definition:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const fetchBodyMeasurementSessions = async (
  options: MeasurementDisplayOptions,
  limit?: number,
): Promise<BodyMeasurementSession[]> => {
  try {
    const db = await openDatabase("userData.db");
    const limitClause = limit !== undefined ? `LIMIT ${limit}` : "";
    const rows = (await db.getAllAsync(
      `SELECT
         bme.id          AS entry_id,
         bme.recorded_at,
         bmd.id,
         bmd.key,
         bmd.label,
         bmd.value_kind,
         bmd.is_builtin,
         bmd.is_active,
         bmd.is_deleted,
         bmd.sort_order,
         bmv.value
       FROM (
         SELECT id, recorded_at FROM body_measurement_entries
         ORDER BY recorded_at DESC
         ${limitClause}
       ) bme
       JOIN body_measurement_values bmv ON bmv.entry_id = bme.id
       JOIN body_metric_definitions bmd ON bmd.id = bmv.metric_id
       ORDER BY bme.recorded_at DESC, bmd.sort_order ASC`,
    )) as (RawMetricDefinitionRow & {
      entry_id: number;
      recorded_at: string;
      value: number;
    })[];

    const sessionMap = new Map<number, BodyMeasurementSession>();
    for (const row of rows) {
      if (!sessionMap.has(row.entry_id)) {
        sessionMap.set(row.entry_id, {
          entry: { id: row.entry_id, recorded_at: row.recorded_at },
          values: [],
        });
      }
      const metric = rowToMetricDefinition(row);
      const { displayValue, displayUnit } = toDisplayValue(
        row.value,
        metric.value_kind,
        options,
      );
      sessionMap.get(row.entry_id)!.values.push({
        metric,
        canonicalValue: row.value,
        displayValue,
        displayUnit,
      });
    }
    return Array.from(sessionMap.values());
  } catch (error: any) {
    console.error("Error fetching body measurement sessions:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const fetchBodyMeasurementSessionsForChart = async (
  metricId: number,
  options: MeasurementDisplayOptions,
): Promise<{ recorded_at: string; displayValue: number }[]> => {
  try {
    const db = await openDatabase("userData.db");
    const metricRow = await db.getFirstAsync<RawMetricDefinitionRow>(
      `SELECT * FROM body_metric_definitions WHERE id = ?`,
      [metricId],
    );
    if (!metricRow) return [];
    const metric = rowToMetricDefinition(metricRow);
    const rows = (await db.getAllAsync(
      `SELECT bme.recorded_at, bmv.value
       FROM body_measurement_values bmv
       JOIN body_measurement_entries bme ON bme.id = bmv.entry_id
       WHERE bmv.metric_id = ?
       ORDER BY bme.recorded_at ASC`,
      [metricId],
    )) as { recorded_at: string; value: number }[];
    return rows.map((row) => ({
      recorded_at: row.recorded_at,
      displayValue: toDisplayValue(row.value, metric.value_kind, options)
        .displayValue,
    }));
  } catch (error: any) {
    console.error("Error fetching body measurement sessions for chart:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const insertBodyMeasurementSession = async (
  recorded_at: string,
  values: { metric_id: number; value: number }[],
): Promise<number> => {
  try {
    const db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    let entryId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        `INSERT INTO body_measurement_entries (recorded_at) VALUES (?)`,
        [recorded_at],
      );
      entryId = result.lastInsertRowId;
      for (const v of values) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
          [entryId, v.metric_id, v.value],
        );
      }
      if (weightMetric) {
        const weightValue = values.find((v) => v.metric_id === weightMetric.id);
        if (weightValue) {
          await txn.runAsync(
            `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
            [recorded_at, weightValue.value],
          );
          // Recompute settings.bodyWeight from the latest remaining weight so
          // inserting a past-dated entry doesn't overwrite a newer one.
          const latestWeight = await txn.getFirstAsync<{ body_weight: number }>(
            `SELECT body_weight FROM body_measurements
             WHERE body_weight IS NOT NULL
             ORDER BY date DESC LIMIT 1`,
          );
          if (latestWeight) {
            await txn.runAsync(
              `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
              [latestWeight.body_weight.toString()],
            );
          }
        }
      }
    });
    return entryId;
  } catch (error: any) {
    console.error("Error inserting body measurement session:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const updateBodyMeasurementSession = async (
  entry_id: number,
  values: { metric_id: number; value: number }[],
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (values.length === 0) {
        await txn.runAsync(
          `DELETE FROM body_measurement_values WHERE entry_id = ?`,
          [entry_id],
        );
      } else {
        const placeholders = values.map(() => "?").join(", ");
        await txn.runAsync(
          `DELETE FROM body_measurement_values WHERE entry_id = ? AND metric_id NOT IN (${placeholders})`,
          [entry_id, ...values.map((v) => v.metric_id)],
        );
      }
      for (const v of values) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
          [entry_id, v.metric_id, v.value],
        );
      }
      // Mirror weight changes to legacy tables
      if (weightMetric) {
        const weightValue = values.find((v) => v.metric_id === weightMetric.id);
        const entry = await txn.getFirstAsync<{ recorded_at: string }>(
          `SELECT recorded_at FROM body_measurement_entries WHERE id = ?`,
          [entry_id],
        );
        if (entry) {
          if (weightValue) {
            const updateResult = await txn.runAsync(
              `UPDATE body_measurements SET body_weight = ? WHERE date = ?`,
              [weightValue.value, entry.recorded_at],
            );
            if (updateResult.changes === 0) {
              await txn.runAsync(
                `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
                [entry.recorded_at, weightValue.value],
              );
            }
          } else {
            // Weight metric was removed from this entry — NULL out legacy row
            await txn.runAsync(
              `UPDATE body_measurements SET body_weight = NULL WHERE date = ?`,
              [entry.recorded_at],
            );
          }
          // Recompute settings.bodyWeight from the latest remaining weight
          const latestWeight = await txn.getFirstAsync<{ body_weight: number }>(
            `SELECT body_weight FROM body_measurements
             WHERE body_weight IS NOT NULL
             ORDER BY date DESC LIMIT 1`,
          );
          if (latestWeight) {
            await txn.runAsync(
              `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
              [latestWeight.body_weight.toString()],
            );
          } else {
            await txn.runAsync(`DELETE FROM settings WHERE key = 'bodyWeight'`);
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Error updating body measurement session:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const deleteBodyMeasurementSession = async (
  entry_id: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Read the entry's timestamp and weight value before deleting
      const entry = await txn.getFirstAsync<{
        recorded_at: string;
        weight: number | null;
      }>(
        `SELECT e.recorded_at, v.value AS weight
         FROM body_measurement_entries e
         LEFT JOIN body_measurement_values v
           ON v.entry_id = e.id AND v.metric_id = ?
         WHERE e.id = ?`,
        [weightMetric?.id ?? -1, entry_id],
      );
      await txn.runAsync(
        `DELETE FROM body_measurement_values WHERE entry_id = ?`,
        [entry_id],
      );
      await txn.runAsync(`DELETE FROM body_measurement_entries WHERE id = ?`, [
        entry_id,
      ]);
      if (entry) {
        await txn.runAsync(`DELETE FROM body_measurements WHERE date = ?`, [
          entry.recorded_at,
        ]);
        if (entry.weight !== null) {
          const currentSetting = await txn.getFirstAsync<{ value: string }>(
            `SELECT value FROM settings WHERE key = 'bodyWeight'`,
          );
          if (
            currentSetting &&
            Math.abs(parseFloat(currentSetting.value) - entry.weight) < 0.001
          ) {
            const nextWeight = await txn.getFirstAsync<{
              body_weight: number;
            }>(
              `SELECT body_weight FROM body_measurements
               WHERE body_weight IS NOT NULL
               ORDER BY date DESC LIMIT 1`,
            );
            if (nextWeight) {
              await txn.runAsync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
                [nextWeight.body_weight.toString()],
              );
            } else {
              await txn.runAsync(
                `DELETE FROM settings WHERE key = 'bodyWeight'`,
              );
            }
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Error deleting body measurement session:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const saveBodyWeightMeasurement = async (
  weightKg: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    const now = new Date().toISOString();
    // Legacy table — keeps useExerciseHistoryQuery.ts working unchanged
    await db.runAsync(
      `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
      [now, weightKg],
    );
    // New measurement tables
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    if (weightMetric) {
      const result = await db.runAsync(
        `INSERT INTO body_measurement_entries (recorded_at) VALUES (?)`,
        [now],
      );
      await db.runAsync(
        `INSERT INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
        [result.lastInsertRowId, weightMetric.id, weightKg],
      );
    }
  } catch (error: any) {
    console.error("Error saving body weight measurement:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Adaptive Progression
// ---------------------------------------------------------------------------

export interface ProgressionSettings {
  enabled: boolean;
  increments: UserProgressionIncrements;
}

export const getProgressionSettings =
  async (): Promise<ProgressionSettings> => {
    try {
      const db = await openDatabase("userData.db");
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (
        'adaptive_progression_enabled',
        'progression_increment_barbell_kg',
        'progression_increment_dumbbell_kg',
        'progression_increment_cable_kg',
        'progression_increment_machine_kg'
      )`,
      );
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      return {
        enabled: map["adaptive_progression_enabled"] === "1",
        increments: {
          barbellKg: parseFloat(
            map["progression_increment_barbell_kg"] ?? "2.5",
          ),
          dumbbellKg: parseFloat(
            map["progression_increment_dumbbell_kg"] ?? "2.0",
          ),
          cableKg: parseFloat(map["progression_increment_cable_kg"] ?? "2.5"),
          machineKg: parseFloat(
            map["progression_increment_machine_kg"] ?? "2.5",
          ),
        },
      };
    } catch (error: any) {
      console.error("Error fetching progression settings:", error);
      Bugsnag.notify(error);
      throw error;
    }
  };

export const setProgressionSetting = async (
  key: string,
  value: string,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  } catch (error: any) {
    console.error("Error setting progression setting:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const getDeloadWeek = async (planId: number): Promise<string | null> => {
  try {
    const db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [`plan_${planId}_deload_week`],
    );
    return row?.value ?? null;
  } catch (error: any) {
    console.error("Error fetching deload week:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const setDeloadWeek = async (
  planId: number,
  isoWeek: string | null,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    const key = `plan_${planId}_deload_week`;
    if (isoWeek === null) {
      await db.runAsync(`DELETE FROM settings WHERE key = ?`, [key]);
    } else {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [key, isoWeek],
      );
    }
  } catch (error: any) {
    console.error("Error setting deload week:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const getMaxWorkingWeightForCompletedExercise = async (
  completedExerciseId: number,
): Promise<number | null> => {
  try {
    const db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{ weight: number }>(
      `SELECT MAX(weight) AS weight
       FROM completed_sets
       WHERE completed_exercise_id = ?
         AND is_warmup = 0
         AND weight IS NOT NULL`,
      [completedExerciseId],
    );
    return row?.weight ?? null;
  } catch (error: any) {
    console.error("Error fetching max working weight:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const insertExerciseFeedback = async (
  payload: ExerciseFeedbackPayload,
): Promise<number> => {
  try {
    const db = await openDatabase("userData.db");
    const result = await db.runAsync(
      `INSERT INTO exercise_feedback (
        user_workout_exercise_id, effort_rating, pain_flag,
        progression_intent, performance_ratio, notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.userWorkoutExerciseId,
        payload.effortRating,
        payload.painFlag,
        payload.progressionIntent ?? null,
        payload.performanceRatio,
        payload.notes ?? null,
      ],
    );
    return result.lastInsertRowId;
  } catch (error: any) {
    console.error("Error inserting exercise feedback:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const getRecentExerciseFeedback = async (
  userWorkoutExerciseId: number,
  limit: number = 3,
): Promise<ExerciseFeedback[]> => {
  try {
    const db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      id: number;
      effort_rating: string;
      pain_flag: string;
      progression_intent: string | null;
      performance_ratio: number;
      created_at: string;
    }>(
      `SELECT id, effort_rating, pain_flag, progression_intent, performance_ratio, created_at
       FROM exercise_feedback
       WHERE user_workout_exercise_id = ? AND is_deleted = 0
       ORDER BY created_at DESC
       LIMIT ?`,
      [userWorkoutExerciseId, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      effortRating: row.effort_rating as ExerciseFeedback["effortRating"],
      painFlag: row.pain_flag as ExerciseFeedback["painFlag"],
      progressionIntent:
        (row.progression_intent as ExerciseFeedback["progressionIntent"]) ??
        undefined,
      performanceRatio: row.performance_ratio,
      createdAt: row.created_at,
    }));
  } catch (error: any) {
    console.error("Error fetching exercise feedback:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export interface UpsertProgressionExtras {
  discomfortStreakCount: number;
  consecutiveHoldCount: number;
  plateauAdvisory: boolean;
  lastProgressionAt: string | null;
}

export const upsertProgressionState = async (
  userWorkoutExerciseId: number,
  result: ProgressionRuleResult,
  sourceFeedbackId: number,
  consecutiveDirectionCount: number,
  extras: UpsertProgressionExtras,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT INTO exercise_progression_state (
        user_workout_exercise_id, suggestion_action, suggested_weight,
        suggested_reps_per_set, suggested_sets,
        rule_key, rule_explanation, source_feedback_id,
        consecutive_direction_count, is_applied, is_dismissed,
        discomfort_streak_count, consecutive_hold_count, plateau_advisory,
        last_progression_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_workout_exercise_id) DO UPDATE SET
        suggestion_action = excluded.suggestion_action,
        suggested_weight = excluded.suggested_weight,
        suggested_reps_per_set = excluded.suggested_reps_per_set,
        suggested_sets = excluded.suggested_sets,
        rule_key = excluded.rule_key,
        rule_explanation = excluded.rule_explanation,
        source_feedback_id = excluded.source_feedback_id,
        consecutive_direction_count = excluded.consecutive_direction_count,
        is_applied = 0,
        is_dismissed = 0,
        discomfort_streak_count = excluded.discomfort_streak_count,
        consecutive_hold_count = excluded.consecutive_hold_count,
        plateau_advisory = excluded.plateau_advisory,
        last_progression_at = excluded.last_progression_at,
        updated_at = datetime('now')`,
      [
        userWorkoutExerciseId,
        result.action,
        result.suggestedWeight ?? null,
        result.suggestedRepsPerSet != null
          ? JSON.stringify(result.suggestedRepsPerSet)
          : null,
        result.suggestedSets ?? null,
        result.ruleKey,
        result.explanation,
        sourceFeedbackId,
        consecutiveDirectionCount,
        extras.discomfortStreakCount,
        extras.consecutiveHoldCount,
        extras.plateauAdvisory ? 1 : 0,
        extras.lastProgressionAt,
      ],
    );
  } catch (error: any) {
    console.error("Error upserting progression state:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const getProgressionState = async (
  userWorkoutExerciseId: number,
): Promise<ExerciseProgressionState | null> => {
  try {
    const db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{
      id: number;
      user_workout_exercise_id: number;
      suggestion_action: string;
      suggested_weight: number | null;
      suggested_reps_per_set: string | null;
      suggested_sets: number | null;
      rule_key: string;
      rule_explanation: string;
      source_feedback_id: number | null;
      recovery_rating: string | null;
      recovery_checked_at: string | null;
      consecutive_direction_count: number;
      discomfort_streak_count: number;
      consecutive_hold_count: number;
      plateau_advisory: number;
      last_progression_at: string | null;
      is_applied: number;
      is_dismissed: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM exercise_progression_state WHERE user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
    if (!row) return null;
    let parsedRepsPerSet: number[] | undefined;
    if (row.suggested_reps_per_set) {
      try {
        parsedRepsPerSet = JSON.parse(row.suggested_reps_per_set);
      } catch {
        parsedRepsPerSet = undefined;
      }
    }
    return {
      id: row.id,
      userWorkoutExerciseId: row.user_workout_exercise_id,
      suggestionAction: row.suggestion_action as ProgressionAction,
      suggestedWeight: row.suggested_weight ?? undefined,
      suggestedRepsPerSet: parsedRepsPerSet,
      suggestedSets: row.suggested_sets ?? undefined,
      ruleKey: row.rule_key,
      ruleExplanation: row.rule_explanation,
      sourceFeedbackId: row.source_feedback_id ?? undefined,
      recoveryRating: (row.recovery_rating as RecoveryRating) ?? undefined,
      recoveryCheckedAt: row.recovery_checked_at ?? undefined,
      consecutiveDirectionCount: row.consecutive_direction_count,
      discomfortStreakCount: row.discomfort_streak_count ?? 0,
      consecutiveHoldCount: row.consecutive_hold_count ?? 0,
      plateauAdvisory: row.plateau_advisory === 1,
      lastProgressionAt: row.last_progression_at ?? undefined,
      isApplied: row.is_applied === 1,
      isDismissed: row.is_dismissed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error: any) {
    console.error("Error fetching progression state:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const updateProgressionStateRecovery = async (
  userWorkoutExerciseId: number,
  recoveryRating: RecoveryRating,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state
       SET recovery_rating = ?, recovery_checked_at = datetime('now'), updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [recoveryRating, userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error updating recovery rating:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const applyProgressionToExercise = async (
  userWorkoutExerciseId: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state SET is_applied = 1, updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error applying progression to exercise:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const dismissProgressionState = async (
  userWorkoutExerciseId: number,
): Promise<void> => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state
       SET is_dismissed = 1, updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error dismissing progression state:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

interface PendingRecoveryRow {
  userWorkoutExerciseId: number;
  exerciseId: number;
  targetMuscle: string;
}

export const getPendingRecoveryCheckIns = async (
  workoutId: number,
): Promise<PendingRecoveryRow[]> => {
  try {
    const db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      user_workout_exercise_id: number;
      exercise_id: number;
      target_muscle: string;
    }>(
      `SELECT eps.user_workout_exercise_id, uwe.exercise_id, e.target_muscle
       FROM exercise_progression_state eps
       JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
       JOIN exercises e ON e.exercise_id = uwe.exercise_id
       JOIN exercise_feedback ef ON ef.id = eps.source_feedback_id
       WHERE uwe.workout_id = ?
         AND uwe.is_deleted = 0
         AND eps.recovery_rating IS NULL
         AND eps.is_dismissed = 0
         AND (julianday('now') - julianday(ef.created_at)) * 24 > 12`,
      [workoutId],
    );
    return rows.map((row) => ({
      userWorkoutExerciseId: row.user_workout_exercise_id,
      exerciseId: row.exercise_id,
      targetMuscle: row.target_muscle,
    }));
  } catch (error: any) {
    console.error("Error fetching pending recovery check-ins:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export interface ExerciseProgressionContext {
  exerciseId: number;
  trackingType: string;
  equipment: string;
  currentSets: import("@/store/workoutStore").Set[];
  recentWorkingWeight: number | null;
  latestFeedback: ExerciseFeedback | null;
  consecutiveDirectionCount: number;
  discomfortStreakCount: number;
}

export const getExerciseProgressionContext = async (
  userWorkoutExerciseId: number,
): Promise<ExerciseProgressionContext | null> => {
  try {
    const db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{
      exercise_id: number;
      sets: string | null;
      tracking_type_override: string | null;
      tracking_type: string | null;
      equipment: string;
      recent_weight: number | null;
    }>(
      `SELECT
        e.exercise_id,
        uwe.sets,
        uwe.tracking_type_override,
        e.tracking_type,
        e.equipment,
        (
          SELECT MAX(cs.weight)
          FROM completed_sets cs
          JOIN completed_exercises ce ON cs.completed_exercise_id = ce.id
          JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
          WHERE ce.exercise_id = e.exercise_id
            AND cw.workout_id = uwe.workout_id
            AND cs.is_warmup = 0
            AND cs.weight IS NOT NULL
        ) AS recent_weight
      FROM user_workout_exercises uwe
      JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE uwe.id = ?`,
      [userWorkoutExerciseId],
    );
    if (!row) return null;

    let currentSets: import("@/store/workoutStore").Set[] = [];
    try {
      currentSets = row.sets ? JSON.parse(row.sets) : [];
    } catch {
      /* empty */
    }

    const feedbackRows = await getRecentExerciseFeedback(
      userWorkoutExerciseId,
      1,
    );
    const state = await getProgressionState(userWorkoutExerciseId);

    return {
      exerciseId: row.exercise_id,
      trackingType: row.tracking_type_override ?? row.tracking_type ?? "weight",
      equipment: row.equipment,
      currentSets,
      recentWorkingWeight: row.recent_weight ?? null,
      latestFeedback: feedbackRows[0] ?? null,
      consecutiveDirectionCount: state?.consecutiveDirectionCount ?? 1,
      discomfortStreakCount: state?.discomfortStreakCount ?? 0,
    };
  } catch (error: any) {
    console.error("Error fetching exercise progression context:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export interface WorkoutProgressionStateRow {
  id: number;
  userWorkoutExerciseId: number;
  exerciseName: string;
  suggestionAction: ProgressionAction;
  suggestedWeight?: number;
  /** Per-set suggested rep targets (one per working set, in order). */
  suggestedRepsPerSet?: number[];
  suggestedSets?: number;
  ruleKey: string;
  ruleExplanation: string;
  consecutiveDirectionCount: number;
  plateauAdvisory: boolean;
  lastProgressionAt?: string;
  recoveryRating?: string;
  isApplied: boolean;
  isDismissed: boolean;
}

export const getProgressionStatesForWorkout = async (
  workoutId: number,
): Promise<WorkoutProgressionStateRow[]> => {
  try {
    const db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      id: number;
      user_workout_exercise_id: number;
      exercise_name: string;
      suggestion_action: string;
      suggested_weight: number | null;
      suggested_reps_per_set: string | null;
      suggested_sets: number | null;
      rule_key: string;
      rule_explanation: string;
      consecutive_direction_count: number;
      plateau_advisory: number;
      last_progression_at: string | null;
      recovery_rating: string | null;
      is_applied: number;
      is_dismissed: number;
    }>(
      `SELECT
        eps.id,
        eps.user_workout_exercise_id,
        e.name AS exercise_name,
        eps.suggestion_action,
        eps.suggested_weight,
        eps.suggested_reps_per_set,
        eps.suggested_sets,
        eps.rule_key,
        eps.rule_explanation,
        eps.consecutive_direction_count,
        eps.plateau_advisory,
        eps.last_progression_at,
        eps.recovery_rating,
        eps.is_applied,
        eps.is_dismissed
      FROM exercise_progression_state eps
      JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
      JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE uwe.workout_id = ?
        AND eps.is_dismissed = 0
      ORDER BY uwe.exercise_order ASC`,
      [workoutId],
    );
    return rows.map((row) => {
      let parsedRepsPerSet: number[] | undefined;
      if (row.suggested_reps_per_set) {
        try {
          parsedRepsPerSet = JSON.parse(row.suggested_reps_per_set);
        } catch {
          parsedRepsPerSet = undefined;
        }
      }
      return {
        id: row.id,
        userWorkoutExerciseId: row.user_workout_exercise_id,
        exerciseName: row.exercise_name,
        suggestionAction: row.suggestion_action as ProgressionAction,
        suggestedWeight: row.suggested_weight ?? undefined,
        suggestedRepsPerSet: parsedRepsPerSet,
        suggestedSets: row.suggested_sets ?? undefined,
        ruleKey: row.rule_key,
        ruleExplanation: row.rule_explanation,
        consecutiveDirectionCount: row.consecutive_direction_count,
        plateauAdvisory: row.plateau_advisory === 1,
        lastProgressionAt: row.last_progression_at ?? undefined,
        recoveryRating: row.recovery_rating ?? undefined,
        isApplied: row.is_applied === 1,
        isDismissed: row.is_dismissed === 1,
      };
    });
  } catch (error: any) {
    console.error("Error fetching workout progression states:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Sharing helpers
// ---------------------------------------------------------------------------

interface RawPlanRow {
  id: number;
  name: string;
  image_url: string | null;
  is_active: number;
  app_plan_id: number | null;
}

interface RawPlanWorkoutRow {
  workout_id: number;
  workout_name: string;
  workout_order: number;
  exercise_id: number | null;
  app_exercise_id: number | null;
  exercise_name: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  is_unilateral: number;
  double_weight: number;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number;
  superset_group_id: string | null;
}

export const fetchFullPlanForSharing = async (
  planId: number,
): Promise<{
  plan: RawPlanRow;
  workouts: {
    workout_id: number;
    workout_name: string;
    workout_order: number;
    exercises: RawPlanWorkoutRow[];
  }[];
} | null> => {
  const db = await openDatabase("userData.db");

  const plan = await db.getFirstAsync<RawPlanRow>(
    `SELECT id, name, image_url, is_active, app_plan_id FROM user_plans WHERE id = ? AND is_deleted = FALSE`,
    [planId],
  );
  if (!plan) return null;

  const rows = await db.getAllAsync<RawPlanWorkoutRow>(
    `SELECT
       uw.id AS workout_id, uw.name AS workout_name, uw.workout_order,
       e.exercise_id, e.app_exercise_id, e.name AS exercise_name,
       e.animated_url, e.equipment, e.body_part, e.target_muscle,
       e.secondary_muscles, e.tracking_type, e.is_unilateral, e.double_weight,
       uwe.tracking_type_override, uwe.sets, uwe.exercise_order,
       uwe.superset_group_id
     FROM user_workouts uw
     LEFT JOIN user_workout_exercises uwe
       ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
     LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
     WHERE uw.plan_id = ? AND uw.is_deleted = FALSE
     ORDER BY uw.workout_order, uwe.exercise_order`,
    [planId],
  );

  const workoutsMap = new Map<
    number,
    {
      workout_id: number;
      workout_name: string;
      workout_order: number;
      exercises: RawPlanWorkoutRow[];
    }
  >();
  for (const row of rows) {
    if (!workoutsMap.has(row.workout_id)) {
      workoutsMap.set(row.workout_id, {
        workout_id: row.workout_id,
        workout_name: row.workout_name,
        workout_order: row.workout_order,
        exercises: [],
      });
    }
    if (row.exercise_id) {
      workoutsMap.get(row.workout_id)!.exercises.push(row);
    }
  }

  return { plan, workouts: Array.from(workoutsMap.values()) };
};

interface RawStandaloneWorkoutRow {
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  exercise_id: number | null;
  app_exercise_id: number | null;
  exercise_name: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  is_unilateral: number;
  double_weight: number;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number;
  superset_group_id: string | null;
}

export const fetchStandaloneWorkoutForSharing = async (
  workoutId: number,
): Promise<{
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  exercises: RawStandaloneWorkoutRow[];
} | null> => {
  const db = await openDatabase("userData.db");

  const wRow = await db.getFirstAsync<{
    id: number;
    name: string;
    image_url: string | null;
  }>(
    `SELECT id, name, image_url FROM user_workouts WHERE id = ? AND plan_id IS NULL AND is_deleted = FALSE`,
    [workoutId],
  );
  if (!wRow) return null;

  const rows = await db.getAllAsync<RawStandaloneWorkoutRow>(
    `SELECT
       uw.id AS workout_id, uw.name AS workout_name, uw.image_url,
       e.exercise_id, e.app_exercise_id, e.name AS exercise_name,
       e.animated_url, e.equipment, e.body_part, e.target_muscle,
       e.secondary_muscles, e.tracking_type, e.is_unilateral, e.double_weight,
       uwe.tracking_type_override, uwe.sets, uwe.exercise_order,
       uwe.superset_group_id
     FROM user_workouts uw
     LEFT JOIN user_workout_exercises uwe
       ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
     LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
     WHERE uw.id = ? AND uw.is_deleted = FALSE
     ORDER BY uwe.exercise_order`,
    [workoutId],
  );

  const exercises = rows.filter((r) => r.exercise_id != null);
  return {
    workout_id: wRow.id,
    workout_name: wRow.name,
    image_url: wRow.image_url,
    exercises,
  };
};

export const fetchCompletedWorkoutForSharing = async (
  completedWorkoutId: number,
): Promise<{
  id: number;
  plan_name: string | null;
  workout_name: string | null;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  is_deload: number;
  exercises: {
    completed_exercise_id: number;
    exercise_name: string;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup: number;
      is_drop_set: number;
      is_to_failure: number;
    }[];
  }[];
} | null> => {
  const db = await openDatabase("userData.db");

  const cw = await db.getFirstAsync<{
    id: number;
    plan_name: string | null;
    workout_name: string | null;
    date_completed: string;
    duration: number;
    total_sets_completed: number;
    is_deload: number;
  }>(
    `SELECT cw.id, up.name AS plan_name, uw.name AS workout_name,
            cw.date_completed, cw.duration, cw.total_sets_completed, cw.is_deload
     FROM completed_workouts cw
     LEFT JOIN user_plans up ON up.id = cw.plan_id
     LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
     WHERE cw.id = ? AND cw.is_deleted = 0`,
    [completedWorkoutId],
  );
  if (!cw) return null;

  const setRows = await db.getAllAsync<{
    completed_exercise_id: number;
    exercise_name: string;
    set_number: number;
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    is_warmup: number;
    is_drop_set: number;
    is_to_failure: number;
  }>(
    `SELECT ce.id AS completed_exercise_id, e.name AS exercise_name,
            cs.set_number, cs.weight, cs.reps, cs.time, cs.distance,
            cs.is_warmup, cs.is_drop_set, cs.is_to_failure
     FROM completed_exercises ce
     JOIN exercises e ON e.exercise_id = ce.exercise_id
     JOIN completed_sets cs ON cs.completed_exercise_id = ce.id AND cs.is_deleted = 0
     WHERE ce.completed_workout_id = ? AND ce.is_deleted = 0
     ORDER BY ce.id, cs.set_number`,
    [completedWorkoutId],
  );

  const exMap = new Map<
    number,
    {
      completed_exercise_id: number;
      exercise_name: string;
      sets: typeof setRows;
    }
  >();
  for (const row of setRows) {
    if (!exMap.has(row.completed_exercise_id)) {
      exMap.set(row.completed_exercise_id, {
        completed_exercise_id: row.completed_exercise_id,
        exercise_name: row.exercise_name,
        sets: [],
      });
    }
    exMap.get(row.completed_exercise_id)!.sets.push(row);
  }

  return { ...cw, exercises: Array.from(exMap.values()) };
};

export const fetchBodyMeasurementEntryForSharing = async (
  entryId: number,
): Promise<{
  id: number;
  recorded_at: string;
  values: Record<string, number>;
} | null> => {
  const db = await openDatabase("userData.db");

  const entry = await db.getFirstAsync<{ id: number; recorded_at: string }>(
    `SELECT id, recorded_at FROM body_measurement_entries WHERE id = ?`,
    [entryId],
  );
  if (!entry) return null;

  const valueRows = await db.getAllAsync<{ key: string; value: number }>(
    `SELECT bmd.key, bmv.value
     FROM body_measurement_values bmv
     JOIN body_metric_definitions bmd ON bmd.id = bmv.metric_id
     WHERE bmv.entry_id = ?`,
    [entryId],
  );

  const values: Record<string, number> = {};
  for (const v of valueRows) {
    values[v.key] = v.value;
  }

  return { id: entry.id, recorded_at: entry.recorded_at, values };
};

export interface ExercisePRData {
  exercise_id: number;
  app_exercise_id: number | null;
  exercise_name: string;
  tracking_type: string;
  all_time_pr: number;
  all_time_pr_date: string;
  top_sets: {
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    date_completed: string;
  }[];
}

export const fetchPRDataForExercises = async (
  exerciseIds: number[],
): Promise<ExercisePRData[]> => {
  if (exerciseIds.length === 0) return [];
  const db = await openDatabase("userData.db");
  const placeholders = exerciseIds.map(() => "?").join(", ");

  const pmExpr = `CASE e.tracking_type
    WHEN 'weight' THEN (COALESCE(cs.weight, 0) * CASE WHEN e.double_weight = 1 THEN 2 ELSE 1 END) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
    WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - COALESCE(cs.weight, 0)) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
    WHEN 'reps' THEN CAST(COALESCE(cs.reps, 0) AS REAL)
    WHEN 'time' THEN CAST(COALESCE(cs.time, 0) AS REAL)
    WHEN 'distance' THEN CAST(COALESCE(cs.distance, 0) AS REAL)
    ELSE (COALESCE(cs.weight, 0) * CASE WHEN e.double_weight = 1 THEN 2 ELSE 1 END) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
  END`;

  const rows = await db.getAllAsync<{
    exercise_id: number;
    app_exercise_id: number | null;
    exercise_name: string;
    tracking_type: string;
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    date_completed: string;
    pm: number;
    all_time_pr: number;
    rn: number;
  }>(
    `SELECT * FROM (
       SELECT
         e.exercise_id, e.app_exercise_id, e.name AS exercise_name, e.tracking_type,
         cs.weight, cs.reps, cs.time, cs.distance,
         DATE(cw.date_completed) AS date_completed,
         ${pmExpr} AS pm,
         MAX(${pmExpr}) OVER (PARTITION BY e.exercise_id) AS all_time_pr,
         ROW_NUMBER() OVER (PARTITION BY e.exercise_id ORDER BY ${pmExpr} DESC) AS rn
       FROM exercises e
       JOIN completed_exercises ce ON ce.exercise_id = e.exercise_id AND ce.is_deleted = 0
       JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
         AND cs.is_warmup = 0 AND cs.is_deleted = 0
       JOIN completed_workouts cw ON cw.id = ce.completed_workout_id AND cw.is_deleted = 0
       WHERE e.exercise_id IN (${placeholders})
     )
     WHERE rn <= 5`,
    exerciseIds,
  );

  const exerciseMap = new Map<number, ExercisePRData>();
  for (const row of rows) {
    if (!exerciseMap.has(row.exercise_id)) {
      exerciseMap.set(row.exercise_id, {
        exercise_id: row.exercise_id,
        app_exercise_id: row.app_exercise_id,
        exercise_name: row.exercise_name,
        tracking_type: row.tracking_type,
        all_time_pr: row.all_time_pr,
        all_time_pr_date: row.date_completed,
        top_sets: [],
      });
    }
    const entry = exerciseMap.get(row.exercise_id)!;
    // Keep the earliest date where the all-time PR was achieved
    if (
      row.pm >= row.all_time_pr &&
      row.date_completed < entry.all_time_pr_date
    ) {
      entry.all_time_pr_date = row.date_completed;
    }
    entry.top_sets.push({
      weight: row.weight,
      reps: row.reps,
      time: row.time,
      distance: row.distance,
      date_completed: row.date_completed,
    });
  }

  return Array.from(exerciseMap.values());
};

export const reorderTrackedExercises = async (exerciseIds: number[]): Promise<void> => {
  const db = await openDatabase("userData.db");
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = 0; i < exerciseIds.length; i++) {
      await txn.runAsync(
        `UPDATE tracked_exercises SET sort_order = ? WHERE exercise_id = ?`,
        [i, exerciseIds[i]],
      );
    }
  });
};
