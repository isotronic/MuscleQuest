import { useEffect } from "react";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

/**
 * Clears the finished session once the summary screen has mounted, so the
 * workout overview never re-renders against an empty store mid-transition.
 * `fresh` is the summary route param; past workouts opened from history
 * leave the store untouched.
 */
export function useClearFinishedWorkout(fresh: string | undefined) {
  useEffect(() => {
    if (fresh === "true") {
      useActiveWorkoutStore.getState().clearPersistedStore();
    }
  }, [fresh]);
}
