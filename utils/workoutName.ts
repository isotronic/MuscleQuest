import { t } from "@lingui/core/macro";
import { QUICK_WORKOUT_NAME } from "@/constants/quickWorkout";

// A workout name as shown on screen: the Quick Workout fallback is translated,
// user-chosen names pass through.
export function displayWorkoutName(name: string | null | undefined): string {
  return !name || name === QUICK_WORKOUT_NAME ? t`Quick workout` : name;
}
