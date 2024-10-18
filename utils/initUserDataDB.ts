import * as SQLite from "expo-sqlite";

export async function initUserDataDB() {
  const db = await SQLite.openDatabaseAsync("userData.db");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS muscles (
      muscle TEXT PRIMARY KEY
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_parts (
      body_part TEXT PRIMARY KEY
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS equipment_list (
      equipment TEXT PRIMARY KEY
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      exercise_id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT, 
      image BLOB,
      local_animated_uri TEXT, 
      animated_url TEXT,
      equipment TEXT, 
      body_part TEXT, 
      target_muscle TEXT, 
      secondary_muscles TEXT, 
      description TEXT,
      FOREIGN KEY (target_muscle) REFERENCES muscles(muscle),
      FOREIGN KEY (body_part) REFERENCES body_parts(body_part),
      FOREIGN KEY (equipment) REFERENCES equipment_list(equipment)
    );
  `);

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
      workout_id INTEGER NOT NULL,  -- Foreign key to user_workouts table
      exercise_id INTEGER NOT NULL, -- Foreign key to exercises table
      sets TEXT,                    -- JSON array as a string representing the sets
      exercise_order INTEGER,       -- The order of the exercise within the workout
      FOREIGN KEY (workout_id) REFERENCES user_workouts(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(exercise_id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER, -- Reference to the user's plan
      workout_id INTEGER, -- Reference to the original workout from user_workouts
      date_completed DATETIME NOT NULL, -- When the workout was completed
      duration INTEGER, -- Duration of the workout in seconds
      total_sets_completed INTEGER, -- Total number of sets completed in this workout
      FOREIGN KEY (plan_id) REFERENCES user_plans(id),
      FOREIGN KEY (workout_id) REFERENCES user_workouts(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completed_workout_id INTEGER, -- Reference to the completed_workouts table
      exercise_id INTEGER, -- Reference to the original exercise from user_workout_exercises
      FOREIGN KEY (completed_workout_id) REFERENCES completed_workouts(id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(exercise_id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completed_exercise_id INTEGER, -- Reference to the completed_exercise
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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tracked_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL UNIQUE, -- References the exercise being tracked
      date_added DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP -- When this exercise was added for tracking
    );
  `);
}
