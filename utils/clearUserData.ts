import Bugsnag from "@bugsnag/expo";
import { File, Paths } from "expo-file-system";
import * as Updates from "expo-updates";
import { openDatabase } from "./database";

export const clearDatabaseAndReinitialize = async () => {
  const dbFile = new File(Paths.document, "SQLite", "userData.db");

  try {
    if (dbFile.exists) {
      console.log("Deleting the userData.db...");
      dbFile.delete();
      console.log("Database deleted successfully.");
    }

    console.log("Restarting the app...");
    await Updates.reloadAsync();
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error clearing and reinitializing the database:", error);
  }
};

export const clearActivePlanStatus = async () => {
  try {
    const db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE user_plans SET is_active = false WHERE is_active = true`,
    );
    await Updates.reloadAsync();
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error clearing active plan status:", error);
  }
};
