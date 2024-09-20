import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import * as SQLite from "expo-sqlite";

export interface Exercise {
  exercise_id: number;
  name: string;
  image: [];
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
  workoutName: string;
  duration: number;
  totalSetsCompleted: number;
  exercises: {
    exercise_id: number;
    name: string;
    sets: {
      set_number: number;
      weight: number;
      reps: number;
    }[];
  }[];
}

const openDatabase = async (
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
  plan_data: string,
) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(
    `INSERT INTO user_plans (name, image_url, plan_data) VALUES (?, ?, ?)`,
    [name, image_url, plan_data],
  );
};

export const updateWorkoutPlan = async (
  id: number,
  name: string,
  image_url: string,
  plan_data: string,
) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(
    `UPDATE user_plans SET name = ?, image_url = ?, plan_data = ? WHERE id = ?`,
    [name, image_url, plan_data, id],
  );
};

export const deleteWorkoutPlan = async (planId: number) => {
  const db = await openDatabase("userData.db");
  await db.runAsync(`DELETE FROM user_plans WHERE id = ?`, [planId]);
};

export const saveCompletedWorkout = async (
  planId: number,
  workoutName: string,
  duration: number,
  totalSetsCompleted: number,
  exercises: {
    exercise_id: number;
    name: string;
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
      `INSERT INTO completed_workouts (plan_id, name, date_completed, duration, total_sets_completed) VALUES (?, ?, datetime('now'), ?, ?)`,
      [planId, workoutName, duration, totalSetsCompleted],
    );

    const completedWorkoutId = completedWorkoutResult.lastInsertRowId;

    for (const exercise of exercises) {
      // Insert each completed exercise
      const completedExerciseResult = await db.runAsync(
        `INSERT INTO completed_exercises (completed_workout_id, exercise_id, name) VALUES (?, ?, ?)`,
        [completedWorkoutId, exercise.exercise_id, exercise.name],
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
  plan_id: number | null;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number | null;
  exercise_name: string | null;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
}

export const fetchCompletedWorkoutById = async (
  workoutId: number,
): Promise<CompletedWorkout> => {
  const db = await openDatabase("userData.db");

  try {
    const result = (await db.getAllAsync(
      `
      SELECT 
        cw.id as workout_id, 
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
      LEFT JOIN completed_exercises ce ON cw.id = ce.completed_workout_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      WHERE cw.id = ?
      ORDER BY ce.id, cs.set_number;
      `,
      [workoutId],
    )) as CompletedWorkoutRow[];

    if (!result || result.length === 0) {
      throw new Error("No workout found with the provided workoutId.");
    }

    // Process the result to structure it as needed
    const workout: CompletedWorkout = {
      workout_id: workoutId,
      workout_name: result[0]?.workout_name || "",
      date_completed: result[0]?.date_completed || "",
      duration: result[0]?.duration || 0,
      total_sets_completed: result[0]?.total_sets_completed || 0,
      exercises: [],
    };

    const exercisesMap: Record<number, CompletedWorkout["exercises"][0]> = {};

    result.forEach((row: any) => {
      if (row.exercise_id) {
        if (!exercisesMap[row.exercise_id]) {
          exercisesMap[row.exercise_id] = {
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name,
            sets: [],
          };
        }

        if (row.set_number !== null) {
          exercisesMap[row.exercise_id].sets.push({
            set_number: row.set_number,
            weight: row.weight,
            reps: row.reps,
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
