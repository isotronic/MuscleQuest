import {
  STALE_WORKOUT_THRESHOLD_MS,
  isWorkoutStale,
  resolveWorkoutDuration,
} from "../staleWorkout";

const HOUR = 60 * 60 * 1000;
const start = new Date("2026-09-01T10:00:00Z");
const at = (hoursAfterStart: number) =>
  new Date(start.getTime() + hoursAfterStart * HOUR);

describe("isWorkoutStale", () => {
  it("uses a four hour threshold", () => {
    expect(STALE_WORKOUT_THRESHOLD_MS).toBe(4 * HOUR);
  });

  it("is fresh within four hours of the last activity", () => {
    const state = { startTime: start, lastActivityAt: at(1) };
    expect(isWorkoutStale(state, at(5).getTime())).toBe(false);
  });

  it("is stale once more than four hours have passed since the last activity", () => {
    const state = { startTime: start, lastActivityAt: at(1) };
    expect(isWorkoutStale(state, at(5).getTime() + 1)).toBe(true);
  });

  it("falls back to startTime for a workout persisted before lastActivityAt existed", () => {
    const state = { startTime: start, lastActivityAt: null };
    expect(isWorkoutStale(state, at(3).getTime())).toBe(false);
    expect(isWorkoutStale(state, at(5).getTime())).toBe(true);
  });

  it("accepts the ISO strings a rehydrated store may still hold", () => {
    const state = {
      startTime: start.toISOString(),
      lastActivityAt: at(1).toISOString(),
    };
    expect(isWorkoutStale(state, at(6).getTime())).toBe(true);
  });

  it("is never stale without a usable start time", () => {
    expect(
      isWorkoutStale(
        { startTime: undefined, lastActivityAt: null },
        Date.now(),
      ),
    ).toBe(false);
  });
});

describe("resolveWorkoutDuration", () => {
  it("runs to now while the workout is fresh", () => {
    const state = { startTime: start, lastActivityAt: at(1) };
    expect(resolveWorkoutDuration(state, at(1.5).getTime())).toEqual({
      seconds: 5400,
      trimmed: false,
    });
  });

  it("caps a stale workout at its last activity", () => {
    const state = { startTime: start, lastActivityAt: at(1) };
    expect(resolveWorkoutDuration(state, at(72).getTime())).toEqual({
      seconds: 3600,
      trimmed: true,
    });
  });

  it("caps a stale legacy workout at zero rather than days", () => {
    const state = { startTime: start, lastActivityAt: null };
    expect(resolveWorkoutDuration(state, at(72).getTime())).toEqual({
      seconds: 0,
      trimmed: true,
    });
  });
});
