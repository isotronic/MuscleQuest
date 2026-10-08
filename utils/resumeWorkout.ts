import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";
import { isWorkoutStale } from "./staleWorkout";

/**
 * Every way back into a persisted workout goes through here: a workout left
 * for hours asks what to do with it instead of opening straight away, and one
 * that was already saved opens its summary.
 */
export function resumeActiveWorkout(): void {
  const { startTime, lastActivityAt, savedCompletedWorkoutId } =
    useActiveWorkoutStore.getState();
  // Already saved, then killed during a post-save prompt: show what was saved.
  // fresh=true makes the summary clear the leftover session.
  if (savedCompletedWorkoutId != null) {
    router.push({
      pathname: "/(app)/(workout)/workout-summary",
      params: {
        completedWorkoutId: String(savedCompletedWorkoutId),
        fresh: "true",
      },
    });
    return;
  }
  if (isWorkoutStale({ startTime, lastActivityAt })) {
    useStaleWorkoutPromptStore.getState().show();
    return;
  }
  router.push("/(app)/(workout)");
}
