import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Workout } from "@/store/workoutStore";
import * as SQLite from "expo-sqlite";

export interface Exercise {
  exercise_id: number;
  name: string;
  image: number[];
  local_animated_uri: string;
  animated_url: string;
  equipment: string;
  body_part: string;
  target_muscle: string;
  secondary_muscles: string[];
  description: string;
}

export interface SavedWorkout {
  planId: number;
  workoutId: number; // Reference to the user_workouts entry
  duration: number;
  totalSetsCompleted: number;
  exercises: {
    exercise_id: number;
    sets: {
      set_number: number;
      weight: number;
      reps: number;
    }[];
  }[];
}

export const openDatabase = async (
  databaseName: string,
): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });

  await db.execAsync("PRAGMA busy_timeout = 3000;");
  await db.execAsync("PRAGMA journal_mode = WAL;");

  return db;
};

interface SQLiteRow {
  [key: string]: any;
}
interface SettingsEntry {
  value: string;
}

export const copyDataFromAppDataToUserData = async (): Promise<void> => {
  const appDataDB = await openDatabase("appData.db");
  const userDataDB = await openDatabase("userData.db");

  interface ExerciseCheckResult {
    app_exercise_id: number | null;
    name: string;
    image: Uint8Array | null;
    description: string | null;
  }

  const dataVersionEntry: SettingsEntry | null =
    await userDataDB.getFirstAsync<SettingsEntry>(
      "SELECT value FROM settings WHERE key = 'dataVersion'",
    );

  const dataVersion = dataVersionEntry?.value || null;

  if (dataVersion === "1") {
    console.log("Data has already been copied or this is the first version.");
    return;
  }

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

          if (tableName === "exercises") {
            const existingEntry =
              await userDataDB.getFirstAsync<ExerciseCheckResult>(
                `SELECT * FROM ${tableName} WHERE app_exercise_id = ? LIMIT 1`,
                [row["exercise_id"]],
              );

            if (existingEntry) {
              const fieldsToUpdate = insertColumns.filter((col) => {
                switch (col) {
                  case "app_exercise_id":
                    return row[col] !== existingEntry.app_exercise_id;
                  case "name":
                    return row[col] !== existingEntry.name;
                  case "image":
                    return row[col] !== existingEntry.image;
                  case "description":
                    return row[col] !== existingEntry.description;
                  // Add other fields as needed
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
            const values = insertColumns.map((col) => row[col]);
            await userDataDB.runAsync(insertStatement, values);
          }
        }

        await userDataDB.execAsync("COMMIT");
      }
    } catch (error) {
      console.error(`Error copying table ${tableName}:`, error);
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
    ],
    true, // Exclude the auto-incremented exercise_id for userData
  );

  console.log("Updating data version to 1...");
  await userDataDB.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "1"],
  );

  console.log("Data copy completed and version updated.");
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
    throw new Error("Invalid table name");
  }
  return await db.getFirstAsync(`SELECT * FROM ${tableName} WHERE id = ?`, [
    id,
  ]);
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
) => {
  const db = await openDatabase("userData.db"); // Open database once

  // Start the transaction
  await db.withExclusiveTransactionAsync(async (txn) => {
    try {
      // Insert the plan
      const result = await txn.runAsync(
        `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
        [name, image_url],
      );

      const planId = result.lastInsertRowId;

      // Insert the workouts associated with this plan
      await insertWorkouts(txn, planId, workouts);
    } catch (error) {
      console.error("Error inserting workout plan:", error);
      throw error;
    }
  });
};

export const insertWorkouts = async (
  txn: SQLite.SQLiteDatabase, // Pass transaction to avoid nested transactions
  planId: number,
  workouts: Workout[],
) => {
  try {
    for (const workout of workouts) {
      const { exercises, name } = workout;
      const workoutName = name || `Workout ${workouts.indexOf(workout) + 1}`;

      // Insert the workout and get the inserted workout ID
      const result = await txn.runAsync(
        `INSERT INTO user_workouts (plan_id, name) VALUES (?, ?)`,
        [planId, workoutName],
      );

      const workoutId = result.lastInsertRowId;

      // Insert exercises related to this workout
      for (const [exerciseOrder, exercise] of exercises.entries()) {
        const { exercise_id, sets } = exercise;

        // Insert into user_workout_exercises
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (
            workout_id, exercise_id, sets, exercise_order
          ) VALUES (?, ?, ?, ?)`,
          [workoutId, exercise_id, JSON.stringify(sets), exerciseOrder],
        );
      }
    }
  } catch (error) {
    console.error("Error inserting workouts:", error);
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
      for (const workout of workouts) {
        let workoutId = workout.id;
        const workoutName =
          workout.name || `Workout ${workouts.indexOf(workout) + 1}`;

        if (!workoutId) {
          // Insert new workout
          const result = await txn.runAsync(
            `INSERT INTO user_workouts (plan_id, name) VALUES (?, ?)`,
            [id, workoutName],
          );
          workoutId = result.lastInsertRowId;
        } else {
          // Update existing workout
          await txn.runAsync(`UPDATE user_workouts SET name = ? WHERE id = ?`, [
            workoutName,
            workoutId,
          ]);
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
              `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order) VALUES (?, ?, ?, ?)`,
              [
                workoutId,
                exercise.exercise_id,
                JSON.stringify(exercise.sets),
                exerciseOrder,
              ],
            );
          } else {
            // Update existing exercise
            await txn.runAsync(
              `UPDATE user_workout_exercises SET sets = ?, exercise_order = ? WHERE workout_id = ? AND exercise_id = ?`,
              [
                JSON.stringify(exercise.sets),
                exerciseOrder,
                workoutId,
                exercise.exercise_id,
              ],
            );
          }
        }
      }
    } catch (error) {
      console.error("Error updating workout plan:", error);
      throw error;
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
  planId: number,
  workoutId: number,
  duration: number,
  totalSetsCompleted: number,
  exercises: {
    exercise_id: number;
    sets: {
      set_number: number;
      weight: number;
      reps: number;
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
          `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?)`,
          [completedExerciseId, set.set_number, set.weight, set.reps],
        );
      }
    }

    // Commit transaction
    await db.execAsync("COMMIT");
  } catch (error) {
    // Rollback transaction
    try {
      await db.execAsync("ROLLBACK");
      console.error("Transaction rolled back due to error.");
    } catch (rollbackError) {
      console.error("Error during rollback: ", rollbackError);
    }

    // Log and re-throw the original error
    console.error("Error saving completed workout: ", error);
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
  set_number: number | null;
  weight: number | null;
  reps: number | null;
}

export const fetchCompletedWorkoutById = async (
  id: number,
  weightUnit: string = "kg",
): Promise<CompletedWorkout> => {
  const db = await openDatabase("userData.db");

  try {
    const result = (await db.getAllAsync(
      `
      SELECT 
        cw.id, 
        cw.plan_id as plan_id,
        cw.workout_id as workout_id,
        uw.name as workout_name, 
        cw.date_completed, 
        cw.duration, 
        cw.total_sets_completed, 
        e.exercise_id as exercise_id, 
        e.name as exercise_name, 
        e.image as exercise_image, 
        cs.set_number, 
        cs.weight, 
        cs.reps,
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
            sets: [],
            exercise_order: row.exercise_order, // Track exercise order
          };
        }

        if (row.set_number !== null) {
          // Convert weight from kg to the user's unit
          const weightInKg = parseFloat(row.weight?.toString() || "0");
          const convertedWeight = parseFloat(
            (weightInKg * conversionFactor).toFixed(1),
          );

          exercisesMap[row.exercise_id].sets.push({
            set_number: row.set_number,
            weight: convertedWeight,
            reps: row.reps || 0,
          });
        }
      }
    });

    // Sort exercises by exercise_order and assign them to the workout's exercises
    workout.exercises = Object.values(exercisesMap)
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map(({ exercise_order, ...rest }) => rest); // Remove exercise_order from the final output

    return workout;
  } catch (error) {
    console.error("Error fetching completed workout by ID:", error);
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
  } catch (error) {
    console.error("Error fetching exercise images:", error);
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
    { key: "distanceUnit", value: "km" },
    { key: "sizeUnit", value: "cm" },
    { key: "weightIncrement", value: "1" },
    { key: "defaultSets", value: "3" },
    { key: "defaultRestTime", value: "60" },
    { key: "buttonSize", value: "Standard" },
    { key: "timeRange", value: "30" },
    { key: "restTimerVibration", value: "false" },
    { key: "restTimerSound", value: "false" },
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

    return settings as Settings;
  } catch (error) {
    console.error("Database fetching error:", error);
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
  } catch (error) {
    console.error("Error updating setting:", error);
    throw error;
  }
};
