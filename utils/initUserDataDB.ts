import * as SQLite from "expo-sqlite";

export async function initUserDataDB() {
  const db = await SQLite.openDatabaseAsync("userData.db");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_url TEXT,
      is_active BOOLEAN DEFAULT FALSE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER,
      name TEXT NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES user_plans(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER, -- Foreign key to user_workouts table
      exercise_id INTEGER, -- Reference to the exercise
      name TEXT NOT NULL,
      description TEXT,
      image BLOB,
      local_animated_uri TEXT,
      animated_url TEXT,
      equipment TEXT,
      body_part TEXT,
      target_muscle TEXT,
      secondary_muscles TEXT, -- JSON array as a string
      sets TEXT, -- JSON array as a string representing the sets
      FOREIGN KEY (workout_id) REFERENCES user_workouts(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER, -- Foreign key to the user_plans table
      name TEXT, -- Name of the workout
      date_completed DATETIME NOT NULL, -- When the workout was completed
      duration INTEGER, -- Duration of the workout in seconds
      total_sets_completed INTEGER, -- Total number of sets completed in this workout
      FOREIGN KEY (plan_id) REFERENCES user_plans(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completed_workout_id INTEGER, -- Foreign key to the completed_workouts table
      exercise_id INTEGER, -- ID of the exercise (reference to the exercises data)
      name TEXT, -- Name of the exercise
      FOREIGN KEY (completed_workout_id) REFERENCES completed_workouts(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completed_exercise_id INTEGER, -- Foreign key to the completed_exercises table
      set_number INTEGER, -- Set number (1, 2, 3, etc.)
      weight REAL, -- Weight used in this set
      reps INTEGER, -- Number of reps in this set
      FOREIGN KEY (completed_exercise_id) REFERENCES completed_exercises(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
