import * as FileSystem from "expo-file-system";
import { reloadAsync } from "expo-updates";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { QueryClient } from "@tanstack/react-query";
import { setAsyncStorageItem } from "./asyncStorage";

const dbName = "userData.db";

const getDatabasePath = async () => {
  return `${FileSystem.documentDirectory}SQLite/${dbName}`;
};

export const uploadDatabaseBackup = async (
  setBackupProgress: (progress: number) => void,
  setIsBackupLoading: (loading: boolean) => void,
) => {
  try {
    setIsBackupLoading(true); // Start the loading state

    const userId = auth().currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const dbPath = await getDatabasePath();
    const walPath = `${dbPath}-wal`; // Path to WAL file
    const shmPath = `${dbPath}-shm`; // Path to SHM file

    // Check if database, WAL, and SHM files exist
    const dbFileExists = await FileSystem.getInfoAsync(dbPath);
    const walFileExists = await FileSystem.getInfoAsync(walPath);
    const shmFileExists = await FileSystem.getInfoAsync(shmPath);

    if (!dbFileExists.exists) {
      throw new Error("Database file does not exist");
    }
    if (!walFileExists.exists) {
      throw new Error("WAL file does not exist");
    }
    if (!shmFileExists.exists) {
      throw new Error("SHM file does not exist");
    }

    // Storage references
    const dbStorageRef = storage().ref(`backups/${userId}/${dbName}`);
    const walStorageRef = storage().ref(`backups/${userId}/${dbName}-wal`);
    const shmStorageRef = storage().ref(`backups/${userId}/${dbName}-shm`);

    // List of files to upload
    const files = [
      { path: dbPath, ref: dbStorageRef },
      { path: walPath, ref: walStorageRef },
      { path: shmPath, ref: shmStorageRef },
    ];

    let completedFiles = 0;

    for (const { path, ref } of files) {
      const task = ref.putFile(path);

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            const fileProgress =
              (snapshot.bytesTransferred / snapshot.totalBytes) *
              (1 / files.length); // Fractional progress for this file
            const overallProgress =
              (completedFiles / files.length + fileProgress) * 100;
            setBackupProgress(overallProgress);
          },
          (error) => reject(error),
          () => {
            completedFiles += 1;
            resolve();
          },
        );
      });
    }

    console.log("All files uploaded successfully.");
  } catch (error) {
    console.error("Error uploading backup:", error);
    throw error;
  } finally {
    setIsBackupLoading(false); // End the loading state
    setBackupProgress(1);
  }
};

export const fetchLastBackupDate = async (): Promise<Date | null> => {
  try {
    const userId = auth().currentUser?.uid;
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

    const userId = auth().currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const sqlitePath = `${FileSystem.documentDirectory}SQLite/`;
    const dbPath = `${sqlitePath}userData.db`;
    const walPath = `${sqlitePath}userData.db-wal`;
    const shmPath = `${sqlitePath}userData.db-shm`;

    // Define storage references
    const dbStorageRef = storage().ref(`backups/${userId}/userData.db`);
    const walStorageRef = storage().ref(`backups/${userId}/userData.db-wal`);
    const shmStorageRef = storage().ref(`backups/${userId}/userData.db-shm`);

    const files = [
      { ref: dbStorageRef, path: dbPath },
      { ref: walStorageRef, path: walPath },
      { ref: shmStorageRef, path: shmPath },
    ];

    let completedFiles = 0;

    for (const { ref, path } of files) {
      const downloadUrl = await ref.getDownloadURL();

      await new Promise<void>((resolve, reject) => {
        const downloadResumable = FileSystem.createDownloadResumable(
          downloadUrl,
          path,
          undefined,
          (downloadProgress) => {
            const fileProgress =
              (downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite) *
              (1 / files.length); // Fractional progress for this file
            const overallProgress =
              (completedFiles / files.length + fileProgress) * 100;
            setRestoreProgress(overallProgress);
          },
        );

        downloadResumable
          .downloadAsync()
          .then(() => {
            completedFiles += 1;
            resolve();
          })
          .catch(reject);
      });
    }

    console.log("All files restored successfully.");
  } catch (error) {
    console.error("Error restoring database:", error);
    throw error;
  } finally {
    setIsRestoreLoading(false);
    setRestoreProgress(1);

    // Mark the database as restored and reload the app
    await setAsyncStorageItem("databaseRestored", "true");
    await reloadAsync();
  }
};
