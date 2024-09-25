import * as FileSystem from "expo-file-system";
import { initUserDataDB } from "./initUserDataDB";
import { insertDefaultSettings } from "./database";

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
    console.log("Reinitializing the database...");
    await initUserDataDB();
    await insertDefaultSettings();
    console.log("Database reinitialized successfully.");
  } catch (error) {
    console.error("Error clearing and reinitializing the database:", error);
  }
};
