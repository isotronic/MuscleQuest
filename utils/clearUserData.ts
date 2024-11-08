import Bugsnag from "@bugsnag/expo";
import * as FileSystem from "expo-file-system";
import * as Updates from "expo-updates";

export const clearDatabaseAndReinitialize = async () => {
  const dbPath = `${FileSystem.documentDirectory}SQLite/userData.db`;

  try {
    // Check if the database exists
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (dbInfo.exists) {
      console.log("Deleting the userData.db...");
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      console.log("Database deleted successfully.");
    }

    // Reinitialize the database
    console.log("Restarting the app...");
    await Updates.reloadAsync();
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error clearing and reinitializing the database:", error);
  }
};
