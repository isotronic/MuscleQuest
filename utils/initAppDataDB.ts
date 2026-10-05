import Bugsnag from "@bugsnag/expo";
import { File, Directory, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { openDatabase } from "./database";
import { APP_DATA_SYNC, getAppDataSyncVersion } from "./db/appDataSyncVersion";

const DATABASE_NAME = "appData3.db";

const copyDatabase = async (): Promise<void> => {
  const dbFolder = new Directory(Paths.document, "SQLite");
  const dbFile = new File(Paths.document, "SQLite", DATABASE_NAME);
  const oldDbFile1 = new File(Paths.document, "SQLite", "appData1.db");
  const oldDbFile2 = new File(Paths.document, "SQLite", "appData2.db");
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
      oldDbFile1.delete();
    }

    if (oldDbFile2.exists) {
      oldDbFile2.delete();
    }
  } finally {
    await userDataDB.closeAsync();
  }
};

const initializeAppData = async () => {
  await copyDatabase();
};

export { initializeAppData };
