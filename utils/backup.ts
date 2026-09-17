import { Directory, File, Paths } from "expo-file-system";
import { reloadAsync } from "expo-updates";
import {
  getStorage,
  ref,
  getMetadata,
  getDownloadURL,
  putFile,
  deleteObject,
} from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { QueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
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

    const storage = getStorage();
    const dbStorageRef = ref(storage, `backups/${userId}/${dbName}`);
    const walStorageRef = ref(storage, `backups/${userId}/${dbName}-wal`);
    const shmStorageRef = ref(storage, `backups/${userId}/${dbName}-shm`);

    // WAL and SHM are ephemeral: SQLite removes them after a full checkpoint.
    // A fully-checkpointed .db file is a valid self-contained backup, so only
    // include WAL/SHM when they actually exist on disk. Checked once, since
    // the WAL can appear or vanish while uploading.
    const sidecars = [
      { file: walFile, fileRef: walStorageRef },
      { file: shmFile, fileRef: shmStorageRef },
    ].filter(({ file }) => file.exists);
    const files = [
      { path: dbFile.uri, fileRef: dbStorageRef },
      ...sidecars.map(({ file, fileRef }) => ({ path: file.uri, fileRef })),
    ];

    // Remove the previous backup's WAL/SHM before uploading anything. Restore
    // would otherwise apply a stale WAL on top of the newer .db, whether this
    // backup has no WAL or fails partway. A .db with no WAL is still a valid,
    // if slightly older, database.
    for (const fileRef of [walStorageRef, shmStorageRef]) {
      try {
        await deleteObject(fileRef);
      } catch (error: any) {
        if (error?.code !== "storage/object-not-found") {
          throw error;
        }
      }
    }

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
    Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
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
      { fileRef: dbStorageRef, destFile: dbFile, required: true },
      { fileRef: walStorageRef, destFile: walFile, required: false },
      { fileRef: shmStorageRef, destFile: shmFile, required: false },
    ];

    // Download into a staging folder first so a failed download never leaves
    // the live database half-replaced.
    const stagingDir = new Directory(Paths.cache, "restore-staging");
    if (stagingDir.exists) {
      stagingDir.delete();
    }
    stagingDir.create({ intermediates: true });

    try {
      const staged: { stagedFile: File; destFile: File }[] = [];
      let completedFiles = 0;

      for (const { fileRef, destFile, required } of files) {
        const stagedFile = new File(stagingDir, destFile.name);
        try {
          const downloadUrl = await getDownloadURL(fileRef);
          await File.downloadFileAsync(downloadUrl, stagedFile, {
            idempotent: true,
          });
          staged.push({ stagedFile, destFile });
        } catch (error: any) {
          if (!required && error?.code === "storage/object-not-found") {
            // WAL/SHM were not backed up (backup was taken after a checkpoint).
            // Restoring just the main .db file is valid in this case.
          } else {
            throw error;
          }
        }
        completedFiles += 1;
        setRestoreProgress((completedFiles / files.length) * 100);
      }

      // Replace every local file, including a WAL/SHM the backup doesn't have.
      // A leftover local WAL would otherwise be applied to the restored .db.
      // The live files are moved aside rather than deleted, so a failed swap
      // can put them back. File.move repoints the instance it is called on,
      // so fresh instances keep each original path stable.
      const rollbacks: { rollbackFile: File; originalUri: string }[] = [];
      try {
        for (const { destFile } of files) {
          if (destFile.exists) {
            const rollbackFile = new File(
              stagingDir,
              `rollback-${destFile.name}`,
            );
            new File(destFile.uri).move(rollbackFile);
            rollbacks.push({ rollbackFile, originalUri: destFile.uri });
          }
        }
        for (const { stagedFile, destFile } of staged) {
          stagedFile.move(new File(destFile.uri));
        }
      } catch (error) {
        for (const { destFile } of files) {
          const restored = new File(destFile.uri);
          if (restored.exists) {
            restored.delete();
          }
        }
        for (const { rollbackFile, originalUri } of rollbacks) {
          rollbackFile.move(new File(originalUri));
        }
        throw error;
      }
    } finally {
      if (stagingDir.exists) {
        stagingDir.delete();
      }
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
