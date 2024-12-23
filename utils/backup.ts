import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { reloadAsync } from "expo-updates";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { openDatabase } from "./database";
import { QueryClient } from "@tanstack/react-query";
import { setAsyncStorageItem } from "./asyncStorage";

const dbName = "userData.db";
let db: SQLite.SQLiteDatabase | null = null;

const getDatabasePath = async () => {
  return `${FileSystem.documentDirectory}SQLite/${dbName}`;
};

export const uploadDatabaseBackup = async (
  setBackupProgress: (progress: number) => void,
  setIsBackupLoading: (loading: boolean) => void,
) => {
  try {
    setIsBackupLoading(true); // Start the loading state

    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const storageRef = storage().ref(`backups/${userId}/${dbName}`);
    const dbPath = await getDatabasePath();
    const fileStat = await FileSystem.getInfoAsync(dbPath);

    // Check if the file exists
    if (!fileStat.exists) {
      throw new Error("Database file does not exist");
    }

    const db = await openDatabase("userData.db");
    await db.execAsync("PRAGMA wal_checkpoint(FULL);");
    await db.closeAsync();

    // Upload file to Firebase Storage
    const task = storageRef.putFile(dbPath);

    // Monitor upload progress
    task.on("state_changed", (taskSnapshot) => {
      const progress =
        (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100;
      setBackupProgress(progress); // Update the progress bar
      console.log(`${progress.toFixed(2)}% uploaded`);
    });

    await task;
    console.log("Database backup uploaded successfully");
  } catch (error) {
    console.error("Error uploading backup:", error);
  } finally {
    setIsBackupLoading(false); // End the loading state
    setBackupProgress(1);
  }
};

export const fetchLastBackupDate = async (): Promise<Date | null> => {
  try {
    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const storageRef = storage().ref(`backups/${userId}/${dbName}`);
    const metadata = await storageRef.getMetadata();

    if (metadata.updated) {
      return new Date(metadata.updated); // Parse the "updated" timestamp into a Date object
    }

    return null; // Return null if no updated timestamp is available
  } catch (error) {
    console.error("Error fetching last backup date:", error);
    return null;
  }
};

export const restoreDatabaseBackup = async (
  setRestoreProgress: (progress: number) => void,
  setIsRestoreLoading: (loading: boolean) => void,
  queryClient: QueryClient,
) => {
  try {
    setIsRestoreLoading(true);

    const userId = 1; // Replace with auth().currentUser?.uid logic
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const storageRef = storage().ref(`backups/${userId}/userData.db`);
    const downloadUrl = await storageRef.getDownloadURL();

    const sqlitePath = `${FileSystem.documentDirectory}SQLite/`;
    const dbPath = `${sqlitePath}userData.db`;
    const walPath = `${sqlitePath}userData.db-wal`;
    const shmPath = `${sqlitePath}userData.db-shm`;

    db = await openDatabase("userData.db");
    await db.execAsync("PRAGMA wal_checkpoint(FULL);");

    // Close SQLite connection to ensure changes are written to disk
    if (db) {
      await db.closeAsync();
      db = null;
      console.log("Database connection closed.");
    }

    // Delete existing WAL and SHM files
    const walInfo = await FileSystem.getInfoAsync(walPath);
    if (walInfo.exists) {
      await FileSystem.deleteAsync(walPath);
      console.log("WAL file deleted.");
    }

    const shmInfo = await FileSystem.getInfoAsync(shmPath);
    if (shmInfo.exists) {
      await FileSystem.deleteAsync(shmPath);
      console.log("SHM file deleted.");
    }

    // Download the backup file and overwrite the database file
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      dbPath,
      undefined,
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        setRestoreProgress(progress);
      },
    );

    await downloadResumable.downloadAsync();
    console.log("Database restored successfully.");
  } catch (error) {
    console.error("Error restoring database:", error);
    throw error;
  } finally {
    setIsRestoreLoading(false);
    setRestoreProgress(1);

    await setAsyncStorageItem("databaseRestored", "true");
    await reloadAsync();
  }
};
