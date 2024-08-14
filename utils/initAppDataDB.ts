import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { Asset } from "expo-asset";

const DATABASE_NAME = "appData.db";

const copyDatabase = async (): Promise<string> => {
  const dbFolder = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbFolder}/${DATABASE_NAME}`;

  await FileSystem.makeDirectoryAsync(dbFolder, { intermediates: true });

  const dbFileExists = await FileSystem.getInfoAsync(dbPath);

  if (!dbFileExists.exists) {
    const asset = Asset.fromModule(require(`../assets/db/${DATABASE_NAME}`));
    await asset.downloadAsync();

    await FileSystem.copyAsync({ from: asset.localUri!, to: dbPath });
  }

  return dbPath;
};

const openDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  await copyDatabase();
  return await SQLite.openDatabaseAsync(DATABASE_NAME);
};

export { openDatabase };
