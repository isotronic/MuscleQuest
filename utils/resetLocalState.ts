import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useWorkoutStore } from "@/store/workoutStore";
import { useSocialStore } from "@/store/socialStore";
import { cancelRestNotifications } from "@/utils/restNotification";

/**
 * Clears the persisted state that refers to rows in userData.db, for when that
 * database is about to be replaced (restore) or deleted (reset). Call it after
 * the files are in place and right before the reload, so a failed restore
 * keeps the session.
 */
export async function resetLocalSessionState(): Promise<void> {
  useActiveWorkoutStore.getState().clearPersistedStore();
  await cancelRestNotifications();

  useWorkoutStore.setState({ drafts: {} });
  useWorkoutStore.getState().clearDraft();
  await useWorkoutStore.persist.clearStorage();

  // Null, not empty: the listeners fill them again from Firestore.
  useSocialStore.setState({
    publishedPlanIds: null,
    publishedWorkoutIds: null,
  });
}
