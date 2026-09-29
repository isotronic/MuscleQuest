/**
 * Whole seconds from `startTime` to `endMs`. Returns 0 when the start time is
 * missing or unparseable, and never goes negative (clock changes mid-workout).
 */
export function computeWorkoutDurationSeconds(
  startTime: Date | string | null | undefined,
  endMs: number = Date.now(),
): number {
  if (startTime == null) return 0;
  const startMs = new Date(startTime).getTime();
  return Number.isFinite(startMs)
    ? Math.max(0, Math.floor((endMs - startMs) / 1000))
    : 0;
}
