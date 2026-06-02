import { File, Paths } from "expo-file-system";
import { reloadAsync } from "expo-updates";
import {
  getStorage,
  ref,
  getMetadata,
  getDownloadURL,
  putFile,
} from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { QueryClient } from "@tanstack/react-query";
import { setAsyncStorageItem } from "./asyncStorage";

const dbName = "userData.db";

export const uploadDatabaseBackup = async (
  setBackupProgress: (progress: number) => void,
  setIsBackupLoading: (loading: boolean) => void,
) => {
  try {
    setIsBackupLoading(true);

    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const dbFile = new File(Paths.document, "SQLite", dbName);
    const walFile = new File(`${dbFile.uri}-wal`);
    const shmFile = new File(`${dbFile.uri}-shm`);

    if (!dbFile.exists) {
      throw new Error("Database file does not exist");
    }
    if (!walFile.exists) {
      throw new Error("WAL file does not exist");
    }
    if (!shmFile.exists) {
      throw new Error("SHM file does not exist");
    }

    const storage = getStorage();
    const dbStorageRef = ref(storage, `backups/${userId}/${dbName}`);
    const walStorageRef = ref(storage, `backups/${userId}/${dbName}-wal`);
    const shmStorageRef = ref(storage, `backups/${userId}/${dbName}-shm`);

    const files = [
      { path: dbFile.uri, fileRef: dbStorageRef },
      { path: walFile.uri, fileRef: walStorageRef },
      { path: shmFile.uri, fileRef: shmStorageRef },
    ];

    let completedFiles = 0;

    for (const { path, fileRef } of files) {
      const task = putFile(fileRef, path);

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snapshot) => {
            const fileProgress =
              (snapshot.bytesTransferred / snapshot.totalBytes) *
              (1 / files.length);
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
    setIsBackupLoading(false);
    setBackupProgress(100);
  }
};

export const fetchLastBackupDate = async (): Promise<Date | null> => {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const storageRef = ref(getStorage(), `backups/${userId}/${dbName}`);
    const metadata = await getMetadata(storageRef);

    if (metadata.updated) {
      return new Date(metadata.updated);
    }

    return null;
  } catch (error: any) {
    if (error?.code === "storage/object-not-found") {
      return null;
    }
    console.error("Error fetching last backup date:", error);
    return null;
  }
};

export const restoreDatabaseBackup = async (
  setRestoreProgress: (progress: number) => void,
  setIsRestoreLoading: (loading: boolean) => void,
  _queryClient: QueryClient,
) => {
  try {
    setIsRestoreLoading(true);

    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const dbFile = new File(Paths.document, "SQLite", "userData.db");
    const walFile = new File(Paths.document, "SQLite", "userData.db-wal");
    const shmFile = new File(Paths.document, "SQLite", "userData.db-shm");

    const storage = getStorage();
    const dbStorageRef = ref(storage, `backups/${userId}/userData.db`);
    const walStorageRef = ref(storage, `backups/${userId}/userData.db-wal`);
    const shmStorageRef = ref(storage, `backups/${userId}/userData.db-shm`);

    const files = [
      { fileRef: dbStorageRef, destFile: dbFile },
      { fileRef: walStorageRef, destFile: walFile },
      { fileRef: shmStorageRef, destFile: shmFile },
    ];

    let completedFiles = 0;

    for (const { fileRef, destFile } of files) {
      const downloadUrl = await getDownloadURL(fileRef);
      await File.downloadFileAsync(downloadUrl, destFile, { idempotent: true });
      completedFiles += 1;
      setRestoreProgress((completedFiles / files.length) * 100);
    }

    console.log("All files restored successfully.");
    await setAsyncStorageItem("databaseRestored", "true");
    await reloadAsync();
  } catch (error) {
    console.error("Error restoring database:", error);
    throw error;
  } finally {
    setIsRestoreLoading(false);
    setRestoreProgress(100);
  }
};
