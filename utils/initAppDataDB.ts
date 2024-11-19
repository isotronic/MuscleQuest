import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";

const DATABASE_NAME = "appData2.db";

const copyDatabase = async (): Promise<string> => {
  const dbFolder = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbFolder}/${DATABASE_NAME}`;
  const oldDbPath = `${dbFolder}/appData1.db`;
  const userDataDB = await openDatabase("userData.db");

  await FileSystem.makeDirectoryAsync(dbFolder, { intermediates: true });

  const dbFile = await FileSystem.getInfoAsync(dbPath);
  const oldDbFile = await FileSystem.getInfoAsync(oldDbPath);

  let dataVersion: number | null = null;
  try {
    // Attempt to retrieve the data version
    const versionResult = await userDataDB.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      ["dataVersion"],
    );
    dataVersion = Number(versionResult?.value);
    console.log("Data version:", dataVersion);
  } catch (error) {
    console.log(
      "Settings table does not exist. Proceeding to copy database...",
    );
  }

  if (!dbFile.exists || dataVersion === null || dataVersion < 1.7) {
    console.log("Copying appData2.db ...");
    const asset = Asset.fromModule(require(`../assets/db/${DATABASE_NAME}`));
    await asset.downloadAsync();

    await FileSystem.copyAsync({ from: asset.localUri!, to: dbPath });
  }

  if (oldDbFile.exists) {
    console.log("Removing outdated appData1.db ...");
    await FileSystem.deleteAsync(oldDbPath);
  }

  return dbPath;
};

const initializeAppData = async () => {
  await copyDatabase();
};

export { initializeAppData };
