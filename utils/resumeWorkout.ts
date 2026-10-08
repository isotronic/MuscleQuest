import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";
import { isWorkoutStale } from "./staleWorkout";

/**
 * Every way back into a persisted workout goes through here: a workout left
 * for hours asks what to do with it instead of opening straight away, and one
 * that was already saved opens its summary.
 */
/**
 * Summary route params for a session that was already saved, then killed
 * during a post-save prompt; null when it was not saved. fresh=true makes the
 * summary clear the leftover session; resumed=true skips the confetti.
 */
export function savedWorkoutSummaryParams(): Record<string, string> | null {
  const { savedCompletedWorkoutId, savedDurationTrimmed } =
    useActiveWorkoutStore.getState();
  if (savedCompletedWorkoutId == null) return null;
  return {
    completedWorkoutId: String(savedCompletedWorkoutId),
    fresh: "true",
    resumed: "true",
    ...(savedDurationTrimmed ? { durationTrimmed: "true" } : {}),
  };
}

export function resumeActiveWorkout(): void {
  const savedParams = savedWorkoutSummaryParams();
  if (savedParams) {
    router.push({
      pathname: "/(app)/(workout)/workout-summary",
      params: savedParams,
    });
    return;
  }
  const { startTime, lastActivityAt } = useActiveWorkoutStore.getState();
  if (isWorkoutStale({ startTime, lastActivityAt })) {
    useStaleWorkoutPromptStore.getState().show();
    return;
  }
  router.push("/(app)/(workout)");
}
