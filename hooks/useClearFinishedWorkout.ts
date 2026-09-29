import { useEffect } from "react";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { cancelRestNotifications } from "@/utils/restNotification";

/**
 * Clears the finished session (and any pending rest notification) once the
 * summary screen has mounted, so the workout overview never re-renders
 * against an empty store mid-transition.
 * `fresh` is the summary route param; past workouts opened from history
 * leave the store untouched.
 */
export function useClearFinishedWorkout(fresh: string | undefined) {
  useEffect(() => {
    if (fresh === "true") {
      useActiveWorkoutStore.getState().clearPersistedStore();
      // Rest alerts are always scheduled now; none should fire after Finish.
      void cancelRestNotifications();
    }
  }, [fresh]);
}
