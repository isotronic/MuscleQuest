import { Directory, File, Paths } from "expo-file-system";
import { reloadAsync } from "expo-updates";
import Constants from "expo-constants";
import {
  getStorage,
  ref,
  getMetadata,
  getDownloadURL,
  putFile,
  uploadString,
  deleteObject,
} from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { QueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { setAsyncStorageItem } from "./asyncStorage";
import {
  checkDatabaseIntegrity,
  createDatabaseSnapshot,
  readDatabaseSchemaVersion,
} from "./database";
import { LATEST_SCHEMA_VERSION } from "./db/migrations";
import { swapInRestoredFiles } from "./restoreRollback";
import { resetLocalSessionState } from "./resetLocalState";

const dbName = "userData.db";

// The manifest's schemaVersion is the backed-up database's PRAGMA
// user_version. A backup newer than LATEST_SCHEMA_VERSION is refused on
// restore, since the app can't migrate a schema it doesn't know.

// Firebase Storage has no rename, so backups alternate between two slots. An
// upload always writes the slot the manifest does not point at, and only then
// rewrites the manifest. A failed upload leaves the current backup intact.
type BackupSlot = "slotA" | "slotB";

export interface BackupManifest {
  currentSlot: BackupSlot;
  createdAt: string;
  appVersion: string | null;
  schemaVersion: number;
  sizeBytes: number;
}

export type BackupErrorCode =
  | "integrity"
  | "newer-schema"
  | "not-found"
  | "offline"
  | "unknown";

export class BackupError extends Error {
  code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}

// Maps any error from backup or restore to a code the UI can turn into a
// specific message.
export const classifyBackupError = (error: unknown): BackupErrorCode => {
  if (error instanceof BackupError) {
    return error.code;
  }
  const code = (error as { code?: unknown })?.code;
  if (code === "storage/object-not-found") {
    return "not-found";
  }
  const message = String((error as { message?: unknown })?.message ?? "");
  if (
    code === "storage/retry-limit-exceeded" ||
    /network|offline|internet|connection/i.test(message)
  ) {
    return "offline";
  }
  return "unknown";
};

const getUserId = () => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
};

const backupRef = (userId: string, fileName: string) =>
  ref(getStorage(), `backups/${userId}/${fileName}`);

const isObjectNotFound = (error: any) =>
  error?.code === "storage/object-not-found";

const isManifest = (value: any): value is BackupManifest =>
  (value?.currentSlot === "slotA" || value?.currentSlot === "slotB") &&
  typeof value.createdAt === "string" &&
  typeof value.schemaVersion === "number";

// Returns null when the user has no new-format backup yet.
const readManifest = async (userId: string): Promise<BackupManifest | null> => {
  let url: string;
  try {
    url = await getDownloadURL(backupRef(userId, "manifest.json"));
  } catch (error) {
    if (isObjectNotFound(error)) {
      return null;
    }
    throw error;
  }
  // Overwriting an object keeps its download token, so the URL is stable
  // across backups and a cached response would point at an older slot.
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) {
    throw new Error(`Failed to read backup manifest (${response.status})`);
  }
  const manifest = await response.json();
  if (!isManifest(manifest)) {
    throw new Error("Backup manifest is malformed");
  }
  return manifest;
};

const deleteIfExists = async (userId: string, fileName: string) => {
  try {
    await deleteObject(backupRef(userId, fileName));
  } catch (error) {
    if (!isObjectNotFound(error)) {
      throw error;
    }
  }
};

// Recreates an empty working directory in the cache.
const freshCacheDirectory = (name: string) => {
  const dir = new Directory(Paths.cache, name);
  if (dir.exists) {
    dir.delete();
  }
  dir.create({ intermediates: true });
  return dir;
};

export const uploadDatabaseBackup = async (
  setBackupProgress: (progress: number) => void,
  setIsBackupLoading: (loading: boolean) => void,
) => {
  let snapshotDir: Directory | null = null;
  try {
    setIsBackupLoading(true);
    setBackupProgress(0);

    const userId = getUserId();

    const dbFile = new File(Paths.document, "SQLite", dbName);
    if (!dbFile.exists) {
      throw new Error("Database file does not exist");
    }

    snapshotDir = freshCacheDirectory("backup-snapshot");
    const snapshot = await createDatabaseSnapshot(
      new File(snapshotDir, "userData-backup.db"),
    );

    if (!(await checkDatabaseIntegrity(snapshot))) {
      throw new BackupError(
        "integrity",
        "The database failed its integrity check, so it was not uploaded.",
      );
    }

    const manifest = await readManifest(userId);
    const targetSlot: BackupSlot =
      manifest?.currentSlot === "slotA" ? "slotB" : "slotA";

    const task = putFile(backupRef(userId, `${targetSlot}.db`), snapshot.uri);
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (taskSnapshot) => {
          if (taskSnapshot.totalBytes > 0) {
            // Held below 100 until the manifest points at the new slot.
            setBackupProgress(
              (taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 95,
            );
          }
        },
        (error) => reject(error),
        () => resolve(),
      );
    });

    const newManifest: BackupManifest = {
      currentSlot: targetSlot,
      createdAt: new Date().toISOString(),
      appVersion: Constants.expoConfig?.version ?? null,
      schemaVersion: await readDatabaseSchemaVersion(snapshot),
      sizeBytes: snapshot.size,
    };
    await uploadString(
      backupRef(userId, "manifest.json"),
      JSON.stringify(newManifest),
      "raw",
      { contentType: "application/json", cacheControl: "no-store" },
    );

    setBackupProgress(100);
    Bugsnag.leaveBreadcrumb("Backup uploaded", { slot: targetSlot });

    // The first new-format backup supersedes the legacy files. Failing to
    // delete them is harmless, since the manifest takes precedence.
    if (!manifest) {
      try {
        for (const fileName of [dbName, `${dbName}-wal`, `${dbName}-shm`]) {
          await deleteIfExists(userId, fileName);
        }
      } catch (error) {
        console.warn("Failed to delete legacy backup files:", error);
      }
    }
  } catch (error) {
    console.error("Error uploading backup:", error);
    setBackupProgress(0);
    throw error;
  } finally {
    if (snapshotDir?.exists) {
      snapshotDir.delete();
    }
    setIsBackupLoading(false);
  }
};

/**
 * When the account was last backed up; null only when it has no backup.
 * Throws when that could not be determined, so a caller can tell "never
 * backed up" apart from "could not check".
 */
export const readLastBackupDate = async (): Promise<Date | null> => {
  try {
    const userId = getUserId();

    const manifest = await readManifest(userId);
    if (manifest) {
      return new Date(manifest.createdAt);
    }

    // Backups made before the manifest existed.
    const metadata = await getMetadata(backupRef(userId, dbName));
    if (metadata.updated) {
      return new Date(metadata.updated);
    }

    return null;
  } catch (error: any) {
    if (isObjectNotFound(error)) {
      return null;
    }
    throw error;
  }
};

/** As readLastBackupDate, but reports a failure and returns null. */
export const fetchLastBackupDate = async (): Promise<Date | null> => {
  try {
    return await readLastBackupDate();
  } catch (error: any) {
    console.error("Error fetching last backup date:", error);
    Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

// Stages a backup made before the manifest existed: the .db plus whichever
// WAL/SHM were uploaded alongside it.
const stageLegacyBackup = async (
  userId: string,
  stagingDir: Directory,
  setRestoreProgress: (progress: number) => void,
) => {
  const names = [dbName, `${dbName}-wal`, `${dbName}-shm`];
  const staged: { stagedFile: File; name: string }[] = [];
  let completedFiles = 0;

  for (const name of names) {
    const stagedFile = new File(stagingDir, name);
    try {
      const downloadUrl = await getDownloadURL(backupRef(userId, name));
      await File.downloadFileAsync(downloadUrl, stagedFile, {
        idempotent: true,
      });
      staged.push({ stagedFile, name });
    } catch (error) {
      if (name === dbName || !isObjectNotFound(error)) {
        throw error;
      }
      // WAL/SHM were not backed up (backup was taken after a checkpoint).
      // Restoring just the main .db file is valid in this case.
    }
    completedFiles += 1;
    setRestoreProgress((completedFiles / names.length) * 90);
  }

  return staged;
};

const newerSchemaError = () =>
  new BackupError(
    "newer-schema",
    "This backup was made with a newer version of MuscleQuest.",
  );

// Throws unless the staged database passes its integrity check and is not
// from a newer schema. The file is the authority; a manifest only saves a
// download.
const checkStagedDatabase = async (stagedFile: File) => {
  if (!(await checkDatabaseIntegrity(stagedFile))) {
    throw new BackupError(
      "integrity",
      "The downloaded backup failed its integrity check.",
    );
  }
  if ((await readDatabaseSchemaVersion(stagedFile)) > LATEST_SCHEMA_VERSION) {
    throw newerSchemaError();
  }
};

export const restoreDatabaseBackup = async (
  setRestoreProgress: (progress: number) => void,
  setIsRestoreLoading: (loading: boolean) => void,
  _queryClient: QueryClient,
) => {
  try {
    setIsRestoreLoading(true);
    setRestoreProgress(0);

    const userId = getUserId();

    const manifest = await readManifest(userId);
    if (manifest && manifest.schemaVersion > LATEST_SCHEMA_VERSION) {
      throw newerSchemaError();
    }

    // Download into a staging folder first so a failed download never leaves
    // the live database half-replaced.
    const stagingDir = freshCacheDirectory("restore-staging");
    try {
      let staged: { stagedFile: File; name: string }[];

      if (manifest) {
        const stagedFile = new File(stagingDir, dbName);
        const downloadUrl = await getDownloadURL(
          backupRef(userId, `${manifest.currentSlot}.db`),
        );
        await File.downloadFileAsync(downloadUrl, stagedFile, {
          idempotent: true,
        });
        setRestoreProgress(80);

        await checkStagedDatabase(stagedFile);
        setRestoreProgress(90);
        staged = [{ stagedFile, name: dbName }];
      } else {
        const legacy = await stageLegacyBackup(
          userId,
          stagingDir,
          setRestoreProgress,
        );
        // Checked in the staging folder beside its WAL, so the check sees
        // the database as it will be restored.
        await checkStagedDatabase(legacy[0].stagedFile);
        // Closing the check's connection can checkpoint the WAL into the .db
        // and remove the WAL/SHM; the .db is then complete on its own.
        staged = legacy.filter(({ stagedFile }) => stagedFile.exists);
      }

      // Journaled, so a failed or interrupted swap is undone here or at the
      // next startup.
      swapInRestoredFiles(staged);
    } finally {
      if (stagingDir.exists) {
        stagingDir.delete();
      }
    }

    Bugsnag.leaveBreadcrumb("Backup restored");
    await setAsyncStorageItem("databaseRestored", "true");
    // The session, drafts and published ids refer to the replaced database.
    await resetLocalSessionState();
    setRestoreProgress(100);
    await reloadAsync();
  } catch (error) {
    console.error("Error restoring database:", error);
    setRestoreProgress(0);
    throw error;
  } finally {
    setIsRestoreLoading(false);
  }
};
