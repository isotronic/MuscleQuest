import { openDatabase } from "./database";

export async function initUserDataDB() {
  const db = await openDatabase("userData.db");
  await db.execAsync("PRAGMA busy_timeout = 3000;");
  await db.execAsync("PRAGMA journal_mode = WAL;");

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
      app_exercise_id INTEGER DEFAULT NULL, -- NULL for custom exercises, non-NULL for copied exercises
      name TEXT, 
      image BLOB,
      local_animated_uri TEXT, 
      animated_url TEXT,
      equipment TEXT, 
      body_part TEXT, 
      target_muscle TEXT, 
      secondary_muscles TEXT, 
      description TEXT,
      tracking_type TEXT,
      favorite BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (target_muscle) REFERENCES muscles(muscle),
      FOREIGN KEY (body_part) REFERENCES body_parts(body_part),
      FOREIGN KEY (equipment) REFERENCES equipment_list(equipment)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_plan_id INTEGER DEFAULT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      is_active BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER,
      name TEXT NOT NULL,
      image_url TEXT,
      is_deleted BOOLEAN DEFAULT FALSE,
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
      is_deleted BOOLEAN DEFAULT FALSE,
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
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (plan_id) REFERENCES user_plans(id),
      FOREIGN KEY (workout_id) REFERENCES user_workouts(id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completed_workout_id INTEGER, -- Reference to the completed_workouts table
      exercise_id INTEGER, -- Reference to the original exercise from user_workout_exercises
      is_deleted BOOLEAN DEFAULT FALSE,
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
      time INTEGER, -- Duration in seconds of this set
      set_duration INTEGER, -- Seconds from rest-timer-end (or workout start) to Complete Set press
      is_deleted BOOLEAN DEFAULT FALSE,
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

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      body_weight REAL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_metric_definitions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT    NOT NULL UNIQUE,
      label      TEXT    NOT NULL,
      value_kind TEXT    NOT NULL CHECK(value_kind IN ('mass','length','percent')),
      is_builtin INTEGER NOT NULL DEFAULT 0,
      is_active  INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_measurement_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_measurement_values (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id  INTEGER NOT NULL REFERENCES body_measurement_entries(id),
      metric_id INTEGER NOT NULL REFERENCES body_metric_definitions(id),
      value     REAL    NOT NULL,
      UNIQUE(entry_id, metric_id)
    );
  `);

  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_bmv_entry  ON body_measurement_values(entry_id);`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_bmv_metric ON body_measurement_values(metric_id);`,
  );

  await db.execAsync(`
    INSERT OR IGNORE INTO body_metric_definitions
      (key, label, value_kind, is_builtin, is_active, sort_order)
    VALUES
      ('weight',          'Body Weight',   'mass',    1, 1,  0),
      ('body_fat_pct',    'Body Fat %',    'percent', 1, 1,  1),
      ('waist',           'Waist',         'length',  1, 1,  2),
      ('hips',            'Hips',          'length',  1, 1,  3),
      ('chest',           'Chest',         'length',  1, 1,  4),
      ('neck',            'Neck',          'length',  1, 0,  5),
      ('upper_arm_left',  'Upper Arm (L)', 'length',  1, 0,  6),
      ('upper_arm_right', 'Upper Arm (R)', 'length',  1, 0,  7),
      ('thigh_left',      'Thigh (L)',     'length',  1, 0,  8),
      ('thigh_right',     'Thigh (R)',     'length',  1, 0,  9),
      ('calf_left',       'Calf (L)',      'length',  1, 0, 10),
      ('calf_right',      'Calf (R)',      'length',  1, 0, 11);
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('exercise', 'workout_exercise', 'workout', 'plan')),
      reference_id INTEGER NOT NULL,
      secondary_reference_id INTEGER DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (type, reference_id, secondary_reference_id)
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plan_schedule (
      plan_id     INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL, -- 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
      workout_id  INTEGER NOT NULL,
      PRIMARY KEY (plan_id, day_of_week),
      FOREIGN KEY (plan_id)   REFERENCES user_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (workout_id) REFERENCES user_workouts(id) ON DELETE CASCADE
    );
  `);

  // Check if columns already exist
  const exercisesResult = await db.getAllAsync(`
    PRAGMA table_info(exercises);
  `);
  const completed_setsResult = await db.getAllAsync(`
    PRAGMA table_info(completed_sets);
  `);
  const user_plansResult = await db.getAllAsync(`
    PRAGMA table_info(user_plans);
  `);
  const user_workoutsResult = await db.getAllAsync(`
    PRAGMA table_info(user_workouts);
  `);
  const app_exercise_idExists = exercisesResult.some(
    (column: any) => column.name === "app_exercise_id",
  );
  const favoriteExists = exercisesResult.some(
    (column: any) => column.name === "favorite",
  );
  const is_deletedExists = exercisesResult.some(
    (column: any) => column.name === "is_deleted",
  );
  const tracking_typeExists = exercisesResult.some(
    (column: any) => column.name === "tracking_type",
  );
  const timeExists = completed_setsResult.some(
    (column: any) => column.name === "time",
  );
  const distanceExists = completed_setsResult.some(
    (column: any) => column.name === "distance",
  );
  const isWarmupExists = completed_setsResult.some(
    (column: any) => column.name === "is_warmup",
  );
  const isDropSetExists = completed_setsResult.some(
    (column: any) => column.name === "is_drop_set",
  );
  const isToFailureExists = completed_setsResult.some(
    (column: any) => column.name === "is_to_failure",
  );
  const setDurationExists = completed_setsResult.some(
    (column: any) => column.name === "set_duration",
  );
  const app_plan_idExists = user_plansResult.some(
    (column: any) => column.name === "app_plan_id",
  );
  const workout_orderExists = user_workoutsResult.some(
    (column: any) => column.name === "workout_order",
  );
  const workout_imageUrlExists = user_workoutsResult.some(
    (column: any) => column.name === "image_url",
  );
  const isUnilateralExists = exercisesResult.some(
    (column: any) => column.name === "is_unilateral",
  );
  const doubleWeightExists = exercisesResult.some(
    (column: any) => column.name === "double_weight",
  );

  // If the column does not exist, add it
  if (!app_exercise_idExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN app_exercise_id INTEGER DEFAULT NULL;
    `);
  }
  if (!favoriteExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN favorite BOOLEAN DEFAULT FALSE;
    `);
  }
  if (!is_deletedExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    `);
  }
  if (!tracking_typeExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN tracking_type TEXT;
    `);
  }
  if (!timeExists) {
    await db.execAsync(`
      ALTER TABLE completed_sets ADD COLUMN time INTEGER;
    `);
  }
  if (!distanceExists) {
    await db.execAsync(`
      ALTER TABLE completed_sets ADD COLUMN distance REAL;
    `);
  }
  if (!isWarmupExists) {
    await db.execAsync(`
      ALTER TABLE completed_sets ADD COLUMN is_warmup BOOLEAN DEFAULT FALSE;
    `);
  }
  if (!isDropSetExists) {
    await db.execAsync(
      `ALTER TABLE completed_sets ADD COLUMN is_drop_set BOOLEAN DEFAULT FALSE;`,
    );
  }
  if (!isToFailureExists) {
    await db.execAsync(
      `ALTER TABLE completed_sets ADD COLUMN is_to_failure BOOLEAN DEFAULT FALSE;`,
    );
  }
  if (!setDurationExists) {
    await db.execAsync(
      `ALTER TABLE completed_sets ADD COLUMN set_duration INTEGER;`,
    );
  }

  // Idempotent warmup backfill — runs once, resumable if a previous run was interrupted.
  // Gated by a settings flag so it can retry safely across app starts.
  const warmupBackfillDone = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'warmup_backfill_completed'`,
  );
  if (!warmupBackfillDone) {
    const templates = await db.getAllAsync<{
      workout_id: number;
      exercise_id: number;
      sets: string;
    }>(
      `SELECT workout_id, exercise_id, sets FROM user_workout_exercises WHERE sets IS NOT NULL AND is_deleted = FALSE`,
    );
    for (const tmpl of templates) {
      let planSets: { isWarmup?: boolean }[];
      try {
        planSets = JSON.parse(tmpl.sets);
      } catch {
        continue;
      }
      for (let i = 0; i < planSets.length; i++) {
        if (planSets[i].isWarmup) {
          await db.runAsync(
            `UPDATE completed_sets
             SET is_warmup = TRUE
             WHERE set_number = ?
               AND completed_exercise_id IN (
                 SELECT ce.id
                 FROM completed_exercises ce
                 JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
                 WHERE ce.exercise_id = ? AND cw.workout_id = ?
               )`,
            [i + 1, tmpl.exercise_id, tmpl.workout_id],
          );
        }
      }
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('warmup_backfill_completed', 'true')`,
    );
  }

  // Idempotent drop-set / to-failure backfill from plan templates.
  const setTypesBackfillDone = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'set_types_backfill_completed'`,
  );
  if (!setTypesBackfillDone) {
    const setTypeTemplates = await db.getAllAsync<{
      workout_id: number;
      exercise_id: number;
      sets: string;
    }>(
      `SELECT workout_id, exercise_id, sets FROM user_workout_exercises WHERE sets IS NOT NULL AND is_deleted = FALSE`,
    );
    for (const tmpl of setTypeTemplates) {
      let planSets: { isDropSet?: boolean; isToFailure?: boolean }[];
      try {
        planSets = JSON.parse(tmpl.sets);
      } catch {
        continue;
      }
      const matchingIds = await db.getAllAsync<{ id: number }>(
        `SELECT ce.id FROM completed_exercises ce
         JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
         WHERE ce.exercise_id = ? AND cw.workout_id = ?`,
        [tmpl.exercise_id, tmpl.workout_id],
      );
      if (matchingIds.length !== 1) continue;
      const ceId = matchingIds[0].id;

      for (let i = 0; i < planSets.length; i++) {
        const setNum = i + 1;
        if (planSets[i].isDropSet) {
          await db.runAsync(
            `UPDATE completed_sets SET is_drop_set = TRUE WHERE set_number = ? AND completed_exercise_id = ?`,
            [setNum, ceId],
          );
        }
        if (planSets[i].isToFailure) {
          await db.runAsync(
            `UPDATE completed_sets SET is_to_failure = TRUE WHERE set_number = ? AND completed_exercise_id = ?`,
            [setNum, ceId],
          );
        }
      }
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('set_types_backfill_completed', 'true')`,
    );
  }

  if (!app_plan_idExists) {
    await db.execAsync(`
      ALTER TABLE user_plans ADD COLUMN app_plan_id INTEGER DEFAULT NULL;
    `);
  }
  if (!workout_orderExists) {
    await db.execAsync(`
      ALTER TABLE user_workouts ADD COLUMN workout_order INTEGER DEFAULT 0 NOT NULL;
    `);
    // Backfill existing rows: use id as the order so existing plans keep their original sequence
    await db.execAsync(`
      UPDATE user_workouts SET workout_order = id WHERE workout_order IS NULL;
    `);
  }
  if (!workout_imageUrlExists) {
    await db.execAsync(`
      ALTER TABLE user_workouts ADD COLUMN image_url TEXT;
    `);
  }
  if (!isUnilateralExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN is_unilateral BOOLEAN DEFAULT FALSE;
    `);
  }
  if (!doubleWeightExists) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN double_weight BOOLEAN DEFAULT FALSE;
    `);
  }

  const user_workout_exercisesResult = await db.getAllAsync(`
    PRAGMA table_info(user_workout_exercises);
  `);
  const supersetGroupIdExists = user_workout_exercisesResult.some(
    (col: any) => col.name === "superset_group_id",
  );
  if (!supersetGroupIdExists) {
    await db.execAsync(`
      ALTER TABLE user_workout_exercises ADD COLUMN superset_group_id TEXT;
    `);
  }

  const weeklyCompletionsResult = await db.getAllAsync(`
    PRAGMA table_info(weekly_completions);
  `);
  if (weeklyCompletionsResult.length === 0) {
    await db.execAsync(`
      CREATE TABLE weekly_completions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start   TEXT NOT NULL UNIQUE,
        goal         INTEGER NOT NULL,
        completed    INTEGER NOT NULL,
        goal_reached BOOLEAN NOT NULL
      );
    `);
  }

  // Migrate distanceUnit from legacy "km" default to "m"
  await db.runAsync(
    `UPDATE settings SET value = 'm' WHERE key = 'distanceUnit' AND value = 'km';`,
  );

  // Migrate sizeUnit from legacy full-word values (the old commented-out settings UI used these)
  await db.runAsync(
    `UPDATE settings SET value = 'cm' WHERE key = 'sizeUnit' AND value = 'Centimeters';`,
  );
  await db.runAsync(
    `UPDATE settings SET value = 'in' WHERE key = 'sizeUnit' AND value = 'Inches';`,
  );

  // Backfill existing body_measurements rows into the new measurement tables (runs once)
  const bwBackfillDone = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'body_measurements_backfill_v1'`,
  );
  if (!bwBackfillDone) {
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    if (weightMetric) {
      const rows = await db.getAllAsync<{
        date: string;
        body_weight: number;
      }>(
        `SELECT date, body_weight FROM body_measurements WHERE body_weight IS NOT NULL ORDER BY date ASC`,
      );
      for (const row of rows) {
        const result = await db.runAsync(
          `INSERT INTO body_measurement_entries (recorded_at) VALUES (?)`,
          [row.date],
        );
        await db.runAsync(
          `INSERT OR IGNORE INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
          [result.lastInsertRowId, weightMetric.id, row.body_weight],
        );
      }
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('body_measurements_backfill_v1', 'true')`,
    );
  }
}
