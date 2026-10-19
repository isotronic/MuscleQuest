import Bugsnag from "@bugsnag/expo";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";
import { APP_DATA_SYNC, getAppDataSyncVersion } from "./db/appDataSyncVersion";
import { APP_DATA_DB, OLD_APP_DATA_DBS } from "./db/appDataFile";

const DATABASE_NAME = APP_DATA_DB;

const copyDatabase = async (): Promise<void> => {
  const dbFolder = new Directory(Paths.document, "SQLite");
  const dbFile = new File(Paths.document, "SQLite", DATABASE_NAME);
  const oldDbFiles = OLD_APP_DATA_DBS.map(
    (name) => new File(Paths.document, "SQLite", name),
  );
  const userDataDB = await openDatabase("userData.db");

  try {
    dbFolder.create({ intermediates: true, idempotent: true });

    let syncVersion: number = APP_DATA_SYNC.none;
    try {
      syncVersion = await getAppDataSyncVersion(userDataDB);
    } catch {
      // No settings table yet (first launch): copy the database.
    }

    if (!dbFile.exists || syncVersion < APP_DATA_SYNC.exerciseFlagsSynced) {
      Bugsnag.leaveBreadcrumb(`Copying ${DATABASE_NAME}`, { syncVersion });
      const tempFile = new File(
        Paths.document,
        "SQLite",
        `${DATABASE_NAME}.tmp`,
      );
      if (tempFile.exists) {
        tempFile.delete();
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require("../assets/db/appData4.db"));
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

    for (const oldDbFile of oldDbFiles) {
      if (oldDbFile.exists) {
        oldDbFile.delete();
      }
    }
  } finally {
    await userDataDB.closeAsync();
  }
};

const initializeAppData = async () => {
  await copyDatabase();
};

export { initializeAppData };
