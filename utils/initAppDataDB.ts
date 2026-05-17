import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";

const DATABASE_NAME = "appData3.db";

const copyDatabase = async (): Promise<void> => {
  const dbFolder = new Directory(Paths.document, "SQLite");
  const dbFile = new File(Paths.document, "SQLite", DATABASE_NAME);
  const oldDbFile1 = new File(Paths.document, "SQLite", "appData1.db");
  const oldDbFile2 = new File(Paths.document, "SQLite", "appData2.db");
  const userDataDB = await openDatabase("userData.db");

  dbFolder.create({ intermediates: true, idempotent: true });

  let dataVersion: number | null = null;
  try {
    const versionResult = await userDataDB.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      ["dataVersion"],
    );
    const parsed = Number(versionResult?.value);
    dataVersion = isNaN(parsed) ? null : parsed;
    console.log("Data version:", dataVersion);
  } catch {
    console.log(
      "Settings table does not exist. Proceeding to copy database...",
    );
  }

  if (!dbFile.exists || dataVersion === null || dataVersion < 2.0) {
    console.log(`Copying ${DATABASE_NAME} ...`);
    const tempFile = new File(Paths.document, "SQLite", `${DATABASE_NAME}.tmp`);
    if (tempFile.exists) {
      tempFile.delete();
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset = Asset.fromModule(require(`../assets/db/${DATABASE_NAME}`));
    await asset.downloadAsync();
    new File(asset.localUri!).copy(tempFile);
    if (!tempFile.exists) {
      throw new Error(`Failed to stage ${DATABASE_NAME} to temp file`);
    }
    if (dbFile.exists) {
      dbFile.delete();
    }
    tempFile.move(dbFile);
  }

  if (oldDbFile1.exists) {
    console.log(`Removing outdated ${oldDbFile1.name} ...`);
    oldDbFile1.delete();
  }

  if (oldDbFile2.exists) {
    console.log(`Removing outdated ${oldDbFile2.name} ...`);
    oldDbFile2.delete();
  }
};

const initializeAppData = async () => {
  await copyDatabase();
};

export { initializeAppData };
