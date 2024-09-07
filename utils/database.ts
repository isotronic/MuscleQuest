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
  return await db.getAllAsync(`SELECT * FROM ${tableName}`);
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
