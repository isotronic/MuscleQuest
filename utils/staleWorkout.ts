import { computeWorkoutDurationSeconds } from "./workoutDuration";

/** A workout untouched for longer than this is treated as abandoned. */
export const STALE_WORKOUT_THRESHOLD_MS = 4 * 60 * 60 * 1000;

type DateLike = Date | string | null | undefined;

export interface WorkoutActivity {
  startTime: DateLike;
  lastActivityAt: DateLike;
}

const toMs = (value: DateLike): number | null => {
  if (value == null) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * When the workout was last touched, in ms. Workouts persisted before
 * `lastActivityAt` existed fall back to their start time. Timestamps, not
 * local dates, so the device time zone does not matter.
 */
export function lastActivityMs(activity: WorkoutActivity): number | null {
  return toMs(activity.lastActivityAt) ?? toMs(activity.startTime);
}

export function isWorkoutStale(
  activity: WorkoutActivity,
  nowMs: number = Date.now(),
): boolean {
  const lastMs = lastActivityMs(activity);
  return lastMs != null && nowMs - lastMs > STALE_WORKOUT_THRESHOLD_MS;
}

/**
 * The duration to save. A stale workout is capped at its last activity so a
 * session resumed days later does not record a duration of days.
 */
export function resolveWorkoutDuration(
  activity: WorkoutActivity,
  nowMs: number = Date.now(),
): { seconds: number; trimmed: boolean } {
  const trimmed = isWorkoutStale(activity, nowMs);
  const endMs = trimmed ? (lastActivityMs(activity) ?? nowMs) : nowMs;
  return {
    seconds: computeWorkoutDurationSeconds(activity.startTime, endMs),
    trimmed,
  };
}
