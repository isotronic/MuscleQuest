import Bugsnag from "@bugsnag/expo";
import {
  copyDataFromAppDataToUserData,
  refreshLibraryFromAppData,
  syncExerciseFlagsFromAppData,
} from "@/utils/database";
import { loadPremadePlans } from "@/utils/loadPremadePlans";
import {
  exerciseImageFilesInFlight,
  startExerciseImageFiles,
} from "@/utils/exerciseImageFilesRun";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useFirstLaunchSeedingStore } from "@/store/firstLaunchSeedingStore";

/** Seeding progress while it runs blocking; background runs report none. */
export type StartupProgress = {
  stage: "exercises" | "plans";
  done: number;
  total: number;
};

// Brings userData.db in line with the shipped library and plans. Each step is
// gated on the app data sync version, so a run cut short by a kill picks up
// where it stopped. Order matters: plans look exercises up by app_exercise_id,
// and each later step's sync version is above every step before it, so the
// library refresh runs last.
export const runSeedingSteps = async (
  onProgress?: (progress: StartupProgress) => void,
): Promise<void> => {
  await copyDataFromAppDataToUserData(
    onProgress &&
      ((done, total) => onProgress({ stage: "exercises", done, total })),
  );
  await loadPremadePlans(
    onProgress &&
      ((done, total) => onProgress({ stage: "plans", done, total })),
  );
  await syncExerciseFlagsFromAppData();
  await refreshLibraryFromAppData();
};

const setStatus = (status: "running" | "done" | "failed") =>
  useFirstLaunchSeedingStore.setState({ status });

// Rejects when the run failed. Kept so whenSeeded can hand the failure on.
let run: Promise<void> | null = null;

/**
 * Seeds in the background while a new user goes through onboarding. Joins a
 * run in progress. Never rejects: the failure goes to the store and Bugsnag,
 * and whenSeeded rejects for the screen that waits on it.
 */
export const startFirstLaunchSeeding = (): Promise<void> => {
  if (run && useFirstLaunchSeedingStore.getState().status === "running") {
    return run.catch(() => {});
  }
  setStatus("running");
  Bugsnag.leaveBreadcrumb("First-launch seeding started");
  const current = runSeedingSteps().then(
    () => {
      setStatus("done");
      startExerciseImageFiles().catch((error) => notifyBugsnag(error));
    },
    (e) => {
      const error = e instanceof Error ? e : new Error(String(e));
      notifyBugsnag(error);
      setStatus("failed");
      throw error;
    },
  );
  run = current;
  return current.catch(() => {});
};

/** Resolves once seeding is done, at once when none was needed. */
export const whenSeeded = async (): Promise<void> => {
  const { status } = useFirstLaunchSeedingStore.getState();
  if (status === "idle" || status === "done" || !run) return;
  await run;
};

/** Starts seeding again after a failure; joins a retry already running. */
export const retryFirstLaunchSeeding = (): Promise<void> => {
  if (useFirstLaunchSeedingStore.getState().status === "failed") run = null;
  return startFirstLaunchSeeding();
};

/**
 * Resolves once nothing from first-launch work has userData.db open, so a
 * restore can swap the files. A failed seeding counts as settled.
 */
export const whenFilesSettled = async (): Promise<void> => {
  await whenSeeded().catch(() => {});
  await exerciseImageFilesInFlight()?.catch(() => {});
};
