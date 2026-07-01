import Bugsnag from "@bugsnag/expo";
import { File, Paths } from "expo-file-system";
import * as Updates from "expo-updates";
import { openDatabase } from "./database";
import type * as SQLite from "expo-sqlite";

export const clearDatabaseAndReinitialize = async () => {
  const filesToDelete = ["userData.db", "userData.db-wal", "userData.db-shm"];

  try {
    for (const fileName of filesToDelete) {
      const file = new File(Paths.document, "SQLite", fileName);
      if (file.exists) {
        console.log(`Deleting ${fileName}...`);
        file.delete();
      }
    }
    console.log("Database deleted successfully.");

    console.log("Restarting the app...");
    await Updates.reloadAsync();
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error clearing and reinitializing the database:", error);
  }
};

export const clearActivePlanStatus = async () => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE user_plans SET is_active = false WHERE is_active = true`,
    );
    await db.closeAsync();
    db = undefined;
    await Updates.reloadAsync();
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error clearing active plan status:", error);
  } finally {
    if (db) await db.closeAsync();
  }
};
