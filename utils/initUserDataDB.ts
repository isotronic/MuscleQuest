import * as SQLite from "expo-sqlite";

export async function initUserDataDB() {
  const db = await SQLite.openDatabaseAsync("userData.db");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image_url TEXT,
      is_active BOOLEAN DEFAULT FALSE,
      plan_data TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS completed_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER,
      date TEXT NOT NULL,
      workout_data TEXT NOT NULL,
      FOREIGN KEY(plan_id) REFERENCES user_plans(id)
    );
  `);
}
