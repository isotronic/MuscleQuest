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
