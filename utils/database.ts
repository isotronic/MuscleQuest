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
  notes: string | null; // Optional notes field
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
  return await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });
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
  return await db.getAllAsync(`SELECT * FROM ${tableName}`);
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
  const db = await openDatabase("appData.db");
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
  const db = await openDatabase("appData.db");
  return (await db.getAllAsync(
    `SELECT exercise_id, animated_url FROM exercises WHERE animated_url IS NOT NULL AND animated_url != '' AND (local_animated_uri IS NULL OR local_animated_uri = '')`,
  )) as ExerciseWithoutLocalAnimatedUriRow[];
};

export interface ExerciseWithLocalAnimatedUriRow {
  exercise_id: number;
  local_animated_uri: string;
}

export const fetchExercisesWithLocalAnimatedUri = async () => {
  const db = await openDatabase("appData.db");
  return (await db.getAllAsync(
    `SELECT exercise_id, local_animated_uri FROM exercises WHERE local_animated_uri IS NOT NULL AND local_animated_uri != ''`,
  )) as ExerciseWithLocalAnimatedUriRow[];
};

export const clearAllLocalAnimatedUri = async () => {
  const db = await openDatabase("appData.db");
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
  const db = await openDatabase("userData.db");
  const result = await db.runAsync(
    `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
    [name, image_url],
  );

  const planId = result.lastInsertRowId;

  await insertWorkouts(planId, workouts);
};

export const insertWorkouts = async (planId: number, workouts: Workout[]) => {
  const db = await openDatabase("userData.db");

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const workout of workouts) {
      const { exercises, name } = workout;

      // Insert the workout and get the inserted workout ID
      const result = await txn.runAsync(
        `INSERT INTO user_workouts (plan_id, name) VALUES (?, ?)`,
        [planId, name],
      );

      const workoutId = result.lastInsertRowId;

      // Insert each exercise related to this workout
      for (const exercise of exercises) {
        const {
          exercise_id,
          name,
          description,
          image,
          local_animated_uri,
          animated_url,
          equipment,
          body_part,
          target_muscle,
          secondary_muscles,
          sets,
        } = exercise;

        const imageBuffer = new Uint8Array(Object.values(image));

        await txn.runAsync(
          `INSERT INTO user_workout_exercises (
            workout_id, exercise_id, name, description, image, local_animated_uri, animated_url,
            equipment, body_part, target_muscle, secondary_muscles, sets
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise_id,
            name,
            description,
            imageBuffer,
            local_animated_uri,
            animated_url,
            equipment,
            body_part,
            target_muscle,
            JSON.stringify(secondary_muscles),
            JSON.stringify(sets),
          ],
        );
      }
    }
  });
};

export const updateWorkoutPlan = async (
  id: number,
  name: string,
  image_url: string,
  workouts: Workout[],
) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(
    `UPDATE user_plans SET name = ?, image_url = ? WHERE id = ?`,
    [name, image_url, id],
  );

  // Clear existing workouts for the plan
  await db.runAsync(`DELETE FROM user_workouts WHERE plan_id = ?`, [id]);

  // Insert updated workouts
  await insertWorkouts(id, workouts);
};

export const deleteWorkoutPlan = async (planId: number) => {
  const db = await openDatabase("userData.db");

  // Start an exclusive transaction to ensure that all deletions are executed together
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Delete exercises associated with workouts under the plan
    await txn.runAsync(
      `DELETE FROM user_workout_exercises 
       WHERE workout_id IN (
         SELECT id FROM user_workouts WHERE plan_id = ?
       )`,
      [planId],
    );

    // Delete workouts associated with the plan
    await txn.runAsync(`DELETE FROM user_workouts WHERE plan_id = ?`, [planId]);

    // Finally, delete the plan itself
    await txn.runAsync(`DELETE FROM user_plans WHERE id = ?`, [planId]);
  });
};

export const saveCompletedWorkout = async (
  planId: number,
  workoutId: number,
  duration: number,
  totalSetsCompleted: number,
  notes: string | null, // Optional field for notes
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
      `INSERT INTO completed_workouts (plan_id, workout_id, date_completed, duration, total_sets_completed, notes) VALUES (?, ?, datetime('now'), ?, ?, ?)`,
      [planId, workoutId, duration, totalSetsCompleted, notes],
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

    console.log("Completed workout saved successfully.");
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

export const fetchCompletedWorkouts = async () => {
  const db = await openDatabase("userData.db");
  try {
    return await db.getAllAsync(`
          SELECT 
            cw.id as workout_id, 
            cw.plan_id, 
            cw.name as workout_name, 
            cw.date_completed, 
            cw.duration, 
            cw.total_sets_completed, 
            ce.exercise_id as exercise_id, 
            ce.name as exercise_name, 
            cs.set_number, 
            cs.weight, 
            cs.reps
          FROM completed_workouts cw
          JOIN completed_exercises ce ON cw.id = ce.completed_workout_id
          JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
          ORDER BY cw.date_completed DESC, ce.id, cs.set_number;
        `);
  } catch (error) {
    console.error("Error fetching completed workouts: ", error);
  }
};

interface CompletedWorkoutRow {
  workout_id: number;
  plan_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number | null;
  exercise_name: string | null;
  exercise_image: Uint8Array | null;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
}

export const fetchCompletedWorkoutById = async (
  workoutId: number,
  weightUnit: string = "kg",
): Promise<CompletedWorkout> => {
  const db = await openDatabase("userData.db");

  try {
    const result = (await db.getAllAsync(
      `
      SELECT 
        cw.id as workout_id, 
        cw.plan_id as plan_id,
        uw.name as workout_name, 
        cw.date_completed, 
        cw.duration, 
        cw.total_sets_completed, 
        uex.id as exercise_id, 
        uex.name as exercise_name, 
        uex.image as exercise_image, 
        cs.set_number, 
        cs.weight, 
        cs.reps
      FROM completed_workouts cw
      LEFT JOIN completed_exercises ce ON cw.id = ce.completed_workout_id
      LEFT JOIN user_workout_exercises uex ON uex.id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      WHERE cw.id = ?
      ORDER BY uex.id, cs.set_number;
      `,
      [workoutId],
    )) as CompletedWorkoutRow[];

    if (!result || result.length === 0) {
      throw new Error("No workout found with the provided workoutId.");
    }

    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

    // Process the result to structure it as needed
    const workout: CompletedWorkout = {
      workout_id: workoutId,
      plan_id: result[0].plan_id,
      workout_name: result[0]?.workout_name || "",
      date_completed: result[0]?.date_completed || "",
      duration: result[0]?.duration || 0,
      total_sets_completed: result[0]?.total_sets_completed || 0,
      exercises: [],
    };

    const exercisesMap: Record<number, CompletedWorkout["exercises"][0]> = {};

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
          };
        }

        if (row.set_number !== null) {
          // Convert weight from kg to user's unit
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

    workout.exercises = Object.values(exercisesMap);
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

  const db = await openDatabase("appData.db");

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

interface SQLCountResult {
  count: number;
}

export const insertDefaultSettings = async () => {
  const db = await openDatabase("userData.db");

  // Check if settings already exist
  const result = (await db.getAllAsync(
    "SELECT COUNT(*) as count FROM settings",
  )) as SQLCountResult[];

  const { count } = result[0];

  // If no settings exist, insert default values
  if (count === 0) {
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
    ];

    // Insert default settings into the table
    defaultSettings.forEach(async (setting) => {
      await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?)", [
        setting.key,
        setting.value,
      ]);
    });
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
