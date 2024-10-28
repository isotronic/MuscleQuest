import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";

const DATABASE_NAME = "appData.db";

const copyDatabase = async (): Promise<string> => {
  const dbFolder = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbFolder}/${DATABASE_NAME}`;
  const userDataDB = await openDatabase("userData.db");

  await FileSystem.makeDirectoryAsync(dbFolder, { intermediates: true });

  const dbFileExists = await FileSystem.getInfoAsync(dbPath);

  // Check the current dataVersion
  const versionResult = await userDataDB.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ? LIMIT 1`,
    ["dataVersion"],
  );

  const dataVersion = Number(versionResult?.value);
  console.log("Data version:", dataVersion);

  if (!dbFileExists.exists || dataVersion < 1.2) {
    console.log("Copying appData.db ...");
    const asset = Asset.fromModule(require(`../assets/db/${DATABASE_NAME}`));
    await asset.downloadAsync();

    await FileSystem.copyAsync({ from: asset.localUri!, to: dbPath });
  }

  return dbPath;
};

const initializeAppData = async (): Promise<SQLite.SQLiteDatabase> => {
  await copyDatabase();
  return await SQLite.openDatabaseAsync(DATABASE_NAME);
};

export { initializeAppData };
