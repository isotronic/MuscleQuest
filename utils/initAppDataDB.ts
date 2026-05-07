import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";

const DATABASE_NAME = "appData2.db";

const copyDatabase = async (): Promise<void> => {
  const dbFolder = new Directory(Paths.document, "SQLite");
  const dbFile = new File(Paths.document, "SQLite", DATABASE_NAME);
  const oldDbFile = new File(Paths.document, "SQLite", "appData1.db");
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

  if (!dbFile.exists || dataVersion === null || dataVersion < 1.7) {
    console.log("Copying appData2.db ...");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asset = Asset.fromModule(require(`../assets/db/${DATABASE_NAME}`));
    await asset.downloadAsync();
    new File(asset.localUri!).copy(dbFile);
  }

  if (oldDbFile.exists) {
    console.log("Removing outdated appData1.db ...");
    oldDbFile.delete();
  }
};

const initializeAppData = async () => {
  await copyDatabase();
};

export { initializeAppData };
