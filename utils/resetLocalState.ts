import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useWorkoutStore } from "@/store/workoutStore";
import { useSocialStore } from "@/store/socialStore";
import { cancelRestNotifications } from "@/utils/restNotification";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

/**
 * Clears the persisted state that refers to rows in userData.db, for when that
 * database is about to be replaced (restore) or deleted (reset). Call it after
 * the files are in place and right before the reload, so a failed restore
 * keeps the session. Never throws: the files have already changed, so the
 * reload that follows must run regardless. Returns false if any step failed,
 * so startup can retry it.
 */
export async function resetLocalSessionState(): Promise<boolean> {
  const steps: (() => unknown)[] = [
    () => useActiveWorkoutStore.getState().clearPersistedStore(),
    // clearPersistedStore does not wait for its removal; the reload must.
    () => useActiveWorkoutStore.persist.clearStorage(),
    () => cancelRestNotifications(),
    () => {
      useWorkoutStore.setState({ drafts: {} });
      useWorkoutStore.getState().clearDraft();
    },
    () => useWorkoutStore.persist.clearStorage(),
    // Null, not empty: the listeners fill them again from Firestore.
    () =>
      useSocialStore.setState({
        publishedPlanIds: null,
        publishedWorkoutIds: null,
      }),
  ];
  let ok = true;
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      notifyBugsnag(error);
      ok = false;
    }
  }
  return ok;
}

/**
 * The startup form, for the first boot after a restore: it retries a reset
 * that failed before the reload, and does the one a restore killed right after
 * its swap never ran. The persisted stores load asynchronously, so they are
 * loaded first: a late load would bring the cleared state back.
 */
export async function resetLocalSessionStateAfterHydration(): Promise<boolean> {
  let ok = true;
  try {
    await Promise.all([
      useActiveWorkoutStore.persist.rehydrate(),
      useWorkoutStore.persist.rehydrate(),
      useSocialStore.persist.rehydrate(),
    ]);
  } catch (error) {
    notifyBugsnag(error);
    ok = false;
  }
  return (await resetLocalSessionState()) && ok;
}
