import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";
import { isWorkoutStale } from "./staleWorkout";

/**
 * Every way back into a persisted workout goes through here: a workout left
 * for hours asks what to do with it instead of opening straight away.
 */
export function resumeActiveWorkout(): void {
  const { startTime, lastActivityAt } = useActiveWorkoutStore.getState();
  if (isWorkoutStale({ startTime, lastActivityAt })) {
    useStaleWorkoutPromptStore.getState().show();
    return;
  }
  router.push("/(app)/(workout)");
}
