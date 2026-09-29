import { computeWorkoutDurationSeconds } from "@/utils/workoutDuration";

describe("computeWorkoutDurationSeconds", () => {
  const end = Date.parse("2026-09-29T10:30:00.000Z");

  it("returns whole seconds between start and end", () => {
    const start = new Date("2026-09-29T10:00:00.400Z");
    expect(computeWorkoutDurationSeconds(start, end)).toBe(1799);
  });

  it("accepts an ISO string start (rehydrated store)", () => {
    expect(
      computeWorkoutDurationSeconds("2026-09-29T10:29:00.000Z" as any, end),
    ).toBe(60);
  });

  it("returns 0 for an invalid start time", () => {
    expect(computeWorkoutDurationSeconds(new Date("nope"), end)).toBe(0);
  });

  it("returns 0 for a missing start time", () => {
    expect(computeWorkoutDurationSeconds(undefined as any, end)).toBe(0);
  });

  it("never returns a negative duration", () => {
    const start = new Date("2026-09-29T11:00:00.000Z");
    expect(computeWorkoutDurationSeconds(start, end)).toBe(0);
  });
});
