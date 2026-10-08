import Bugsnag from "@bugsnag/expo";
import * as Updates from "expo-updates";
import { initializeAppData } from "@/utils/initAppDataDB";
import { initUserDataDB } from "@/utils/initUserDataDB";
import {
  copyDataFromAppDataToUserData,
  insertDefaultSettings,
  syncExerciseFlagsFromAppData,
  updateAppExerciseIds,
} from "@/utils/database";
import { loadPremadePlans } from "@/utils/loadPremadePlans";
import {
  confirmRestoredDatabase,
  hasRestoreToUndo,
  recoverInterruptedRestore,
  undoLastRestore,
} from "@/utils/restoreRollback";
import { resetLocalSessionStateAfterHydration } from "@/utils/resetLocalState";
import { forgetExerciseImageFiles } from "@/utils/db/exerciseImageFiles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAsyncStorageItem,
  removeAsyncStorageItem,
  setAsyncStorageItem,
} from "@/utils/asyncStorage";

export const DATABASE_RESTORED_KEY = "databaseRestored";
export const STARTUP_FAILURE_COUNT_KEY = "startupFailureCount";

/** First-launch seeding progress; returning users' boots report none. */
export type StartupProgress = {
  stage: "exercises" | "plans";
  done: number;
  total: number;
};

export type StartupResult =
  | { status: "ok" }
  | { status: "reloading" }
  | { status: "failed"; error: Error };

// Runs on every boot, including the first boot after a restore. A backup taken
// on an older app version carries an older PRAGMA user_version, so
// initUserDataDB runs the migrations it is missing. The seeding steps are safe
// against restored data: each is gated on the restored DB's own app data sync
// version (see utils/db/appDataSyncVersion.ts) or only inserts rows that are
// missing (insertDefaultSettings, premade plans by app_plan_id). An older
// backup runs the same upgrade path an older install would.
const initializeDatabases = async (
  databaseRestored: boolean,
  onProgress?: (progress: StartupProgress) => void,
) => {
  // Must run before userData.db is opened: if a restore swap was interrupted,
  // opening it would create an empty database over the missing original. A
  // failure here fails startup rather than continuing without the user's data.
  recoverInterruptedRestore();
  await initializeAppData();
  await initUserDataDB();
  // After the migrations, so a backup from before image_uri has the column.
  // The thumbnail files on this device were written for the database the
  // restore replaced.
  if (databaseRestored) await forgetExerciseImageFiles();
  // Must run before copyData: it only acts on a legacy install (dataVersion
  // 1.1), and copyData matches exercises by app_exercise_id before advancing
  // the sync version past it.
  await updateAppExerciseIds();
  await copyDataFromAppDataToUserData(
    onProgress &&
      ((done, total) => onProgress({ stage: "exercises", done, total })),
  );
  await insertDefaultSettings();
  await loadPremadePlans(
    onProgress &&
      ((done, total) => onProgress({ stage: "plans", done, total })),
  );
  // Must run last: its sync version is above every step before it.
  await syncExerciseFlagsFromAppData();
};

const restoreSwappedWithoutFinishing = (): boolean => {
  try {
    return hasRestoreToUndo();
  } catch {
    return false;
  }
};

export const resetStartupFailureCount = () =>
  removeAsyncStorageItem(STARTUP_FAILURE_COUNT_KEY);

// Initialises the databases. A first failure reloads the app once, since a
// transient cause (locked DB, interrupted copy) often clears on a fresh
// process. A repeated failure returns "failed" so the caller can show a
// recovery screen instead of reloading forever.
export const runStartup = async (
  appCheckReady: Promise<unknown>,
  onProgress?: (progress: StartupProgress) => void,
): Promise<StartupResult> => {
  let databaseRestored =
    (await getAsyncStorageItem(DATABASE_RESTORED_KEY)) === "true";
  if (!databaseRestored && restoreSwappedWithoutFinishing()) {
    // Killed between the swap and the end of the restore: the flag was never
    // set and the old session refers to the replaced database.
    Bugsnag.leaveBreadcrumb("Finishing a restore killed after its swap");
    databaseRestored = true;
  }
  // The old session refers to the replaced database. Normally already cleared
  // before the reload; done again in case that failed or never ran.
  let sessionReset = true;
  if (databaseRestored) {
    Bugsnag.leaveBreadcrumb("First boot after a backup restore");
    sessionReset = await resetLocalSessionStateAfterHydration();
  }

  try {
    await Promise.all([
      appCheckReady,
      initializeDatabases(databaseRestored, onProgress),
    ]);
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("Database initialization error:", error);

    // The storage helpers swallow errors, so AsyncStorage is used directly: if
    // the count can't be persisted, reloading could loop forever.
    let failureCount: number | null = null;
    try {
      failureCount =
        (Number(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)) || 0) +
        1;
      await AsyncStorage.setItem(
        STARTUP_FAILURE_COUNT_KEY,
        String(failureCount),
      );
    } catch (storageError) {
      console.error("Failed to persist startup failure count:", storageError);
      failureCount = null;
    }

    Bugsnag.notify(error, (event) => {
      event.addMetadata("startup", { failureCount, databaseRestored });
    });

    if (failureCount === 1) {
      try {
        await Updates.reloadAsync();
        return { status: "reloading" };
      } catch (reloadError) {
        console.error("Failed to reload after startup error:", reloadError);
      }
    }
    return { status: "failed", error };
  }

  // Cleared only after success, so a failed post-restore boot retries with
  // the flag still set and the pre-restore database still kept.
  confirmRestoredDatabase();
  if (sessionReset) {
    await removeAsyncStorageItem(DATABASE_RESTORED_KEY);
  } else {
    // Kept (or set, after a killed restore) so the next boot retries the reset.
    await setAsyncStorageItem(DATABASE_RESTORED_KEY, "true");
  }
  await resetStartupFailureCount();
  return { status: "ok" };
};

// From the startup recovery screen: puts back the database from before the
// last restore and starts again with it.
export const undoLastRestoreAndReload = async () => {
  // Reloading without an undo would only hit the same failure again.
  if (!undoLastRestore()) {
    throw new Error("There was no restore to undo.");
  }
  await removeAsyncStorageItem(DATABASE_RESTORED_KEY);
  await resetStartupFailureCount();
  await Updates.reloadAsync();
};
