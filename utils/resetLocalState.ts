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
 * reload that follows must run regardless.
 */
export async function resetLocalSessionState(): Promise<void> {
  const steps: (() => unknown)[] = [
    () => useActiveWorkoutStore.getState().clearPersistedStore(),
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
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      notifyBugsnag(error);
    }
  }
}
