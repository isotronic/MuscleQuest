import * as SQLite from "expo-sqlite";

export interface Exercise {
  exercise_id: number;
  name: string;
  image: string;
  image_url: string;
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
  return (await db.getAllAsync(`SELECT * FROM ${tableName}`)) as Exercise[];
};
