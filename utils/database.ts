import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { UserExercise, Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import * as SQLite from "expo-sqlite";

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
  exercises: {
    exercise_id: number;
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
            workout_id, exercise_id, sets, exercise_order, superset_group_id
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise_id,
            JSON.stringify(sets),
            exerciseOrder,
            exercise.supersetGroupId ?? null,
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
              `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id) VALUES (?, ?, ?, ?, ?)`,
              [
                workoutId,
                exercise.exercise_id,
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId ?? null,
              ],
            );
          } else {
            // Update existing exercise
            await txn.runAsync(
              `UPDATE user_workout_exercises SET sets = ?, exercise_order = ?, superset_group_id = ? WHERE workout_id = ? AND exercise_id = ?`,
              [
                JSON.stringify(exercise.sets),
                exerciseOrder,
                exercise.supersetGroupId ?? null,
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
        `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id) VALUES (?, ?, ?, ?, ?)`,
        [
          workoutId,
          exercise.exercise_id,
          JSON.stringify(exercise.sets),
          baseOrder + i,
          exercise.supersetGroupId ?? null,
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
          `UPDATE user_workout_exercises SET exercise_id = ?, sets = ?, exercise_order = ?, superset_group_id = ?, is_deleted = FALSE WHERE id = ?`,
          [
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            existingRow.id,
          ],
        );
      } else {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id) VALUES (?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
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
  exercises: {
    exercise_id: number;
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
      `INSERT INTO completed_workouts (plan_id, workout_id, date_completed, duration, total_sets_completed) VALUES (?, ?, datetime('now'), ?, ?)`,
      [planId, workoutId, duration, totalSetsCompleted],
    );

    const completedWorkoutId = completedWorkoutResult.lastInsertRowId;

    for (const exercise of exercises) {
      // Insert each completed exercise
      const completedExerciseResult = await db.runAsync(
        `INSERT INTO completed_exercises (completed_workout_id, exercise_id) VALUES (?, ?)`,
        [completedWorkoutId, exercise.exercise_id],
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
        e.exercise_id as exercise_id, 
        e.name as exercise_name, 
        e.image as exercise_image, 
        e.tracking_type as exercise_tracking_type,
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
        tracking_type: row.tracking_type || "",
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
        `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id) VALUES (?, ?, ?, ?, ?)`,
        [
          newWorkoutId,
          exercise.exercise_id,
          JSON.stringify(exercise.sets),
          order,
          exercise.supersetGroupId ?? null,
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
          `UPDATE user_workout_exercises SET exercise_id = ?, sets = ?, exercise_order = ?, superset_group_id = ?, is_deleted = FALSE WHERE id = ?`,
          [
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            existingRow.id,
          ],
        );
      } else {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id) VALUES (?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
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
