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
import { recoverInterruptedRestore } from "@/utils/restoreRollback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";

export const DATABASE_RESTORED_KEY = "databaseRestored";
export const STARTUP_FAILURE_COUNT_KEY = "startupFailureCount";

export type StartupResult =
  | { status: "ok" }
  | { status: "reloading" }
  | { status: "failed"; error: Error };

// Runs on every boot, including the first boot after a restore. A backup taken
// on an older app version needs initUserDataDB's ALTER/CREATE statements to
// reach the current schema. The seeding steps are safe against restored data:
// each is gated on the restored DB's own dataVersion (updateAppExerciseIds
// == 1.1, copyData < 1.7, loadPremadePlans < 1.8/2.1, syncExerciseFlags
// < 2.0) or only inserts rows that are missing (insertDefaultSettings, premade
// plans by app_plan_id). An older backup runs the same upgrade path an older
// install would.
const initializeDatabases = async () => {
  // Must run before userData.db is opened: if a restore swap was interrupted,
  // opening it would create an empty database over the missing original. A
  // failure here fails startup rather than continuing without the user's data.
  recoverInterruptedRestore();
  await initializeAppData();
  await initUserDataDB();
  // Must run before copyData: it only acts on dataVersion 1.1, and copyData
  // matches exercises by app_exercise_id before advancing the version to 1.7.
  await updateAppExerciseIds();
  await copyDataFromAppDataToUserData();
  await insertDefaultSettings();
  await loadPremadePlans();
  await syncExerciseFlagsFromAppData();
};

export const resetStartupFailureCount = () =>
  removeAsyncStorageItem(STARTUP_FAILURE_COUNT_KEY);

// Initialises the databases. A first failure reloads the app once, since a
// transient cause (locked DB, interrupted copy) often clears on a fresh
// process. A repeated failure returns "failed" so the caller can show a
// recovery screen instead of reloading forever.
export const runStartup = async (
  appCheckReady: Promise<unknown>,
): Promise<StartupResult> => {
  const databaseRestored =
    (await getAsyncStorageItem(DATABASE_RESTORED_KEY)) === "true";
  console.log("Restore complete:", databaseRestored);

  try {
    await Promise.all([appCheckReady, initializeDatabases()]);
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
  // the flag still set.
  await removeAsyncStorageItem(DATABASE_RESTORED_KEY);
  await resetStartupFailureCount();
  return { status: "ok" };
};
