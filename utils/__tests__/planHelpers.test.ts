import {
  computeWeeklyTargets,
  prioritizeScheduledWorkout,
} from "../planHelpers";
import type { Workout } from "@/store/workoutStore";
import type { PlanScheduleEntry } from "@/utils/database";

const makeWorkout = (id: number): Workout =>
  ({ id, name: `Workout ${id}` }) as Workout;

const makeScheduleEntry = (
  day_of_week: number,
  workout_id: number,
): PlanScheduleEntry => ({ day_of_week, workout_id }) as PlanScheduleEntry;

// ─── prioritizeScheduledWorkout ───────────────────────────────────────────────

describe("prioritizeScheduledWorkout", () => {
  const wA = makeWorkout(1);
  const wB = makeWorkout(2);
  const wC = makeWorkout(3);

  describe("no schedule", () => {
    it("returns uncompleted unchanged when schedule is null", () => {
      expect(prioritizeScheduledWorkout([wA, wB], null, 0, false)).toEqual([
        wA,
        wB,
      ]);
    });

    it("returns uncompleted unchanged when schedule is empty", () => {
      expect(prioritizeScheduledWorkout([wA, wB], [], 0, false)).toEqual([
        wA,
        wB,
      ]);
    });
  });

  describe("rest day", () => {
    it("pins the next scheduled workout to the front", () => {
      // Today = Mon (0), rest day. Tuesday = Workout B.
      const schedule = [makeScheduleEntry(1, wB.id!)];
      const result = prioritizeScheduledWorkout([wA, wB], schedule, 0, true);
      expect(result[0]).toBe(wB);
    });

    it("wraps around the week when the next scheduled day is earlier in the week", () => {
      // Today = Fri (4), rest day. Mon (0) = Workout A.
      const schedule = [makeScheduleEntry(0, wA.id!)];
      const result = prioritizeScheduledWorkout([wA, wB], schedule, 4, true);
      expect(result[0]).toBe(wA);
    });
  });

  describe("non-rest day – today's workout not yet done", () => {
    it("pins today's scheduled workout to the front", () => {
      // Today = Mon (0). Mon = Workout B.
      const schedule = [makeScheduleEntry(0, wB.id!)];
      const result = prioritizeScheduledWorkout([wA, wB], schedule, 0, false);
      expect(result[0]).toBe(wB);
    });

    it("keeps workout at front if already first", () => {
      const schedule = [makeScheduleEntry(0, wA.id!)];
      const result = prioritizeScheduledWorkout([wA, wB], schedule, 0, false);
      expect(result[0]).toBe(wA);
    });
  });

  describe("non-rest day – today's workout fully completed (not in uncompleted list)", () => {
    it("falls back to the next scheduled workout", () => {
      // Mon = Workout A (already completed, not in uncompleted list).
      // Tue = Workout B.
      const schedule = [
        makeScheduleEntry(0, wA.id!),
        makeScheduleEntry(1, wB.id!),
      ];
      // wA is NOT in the uncompleted list (it was moved to completedWorkoutsList)
      const result = prioritizeScheduledWorkout([wB, wC], schedule, 0, false);
      expect(result[0]).toBe(wB);
    });
  });

  describe("non-rest day – today's workout done today but still in uncompleted (target > 1)", () => {
    it("falls back to tomorrow when completedTodayWorkoutIds contains today's workout", () => {
      // Mon = Workout A, Wed = Workout A → target = 2.
      // User completed A today, so completedTimes = 1 < 2 → A still in uncompleted.
      // Tue = Workout B.
      const schedule = [
        makeScheduleEntry(0, wA.id!), // Mon
        makeScheduleEntry(1, wB.id!), // Tue
        makeScheduleEntry(2, wA.id!), // Wed
      ];
      const completedTodayWorkoutIds = new Set<number>([wA.id!]);
      const result = prioritizeScheduledWorkout(
        [wA, wB],
        schedule,
        0, // todayDow = Mon
        false,
        completedTodayWorkoutIds,
      );
      // Should show tomorrow's workout (B) first, not today's (A)
      expect(result[0]).toBe(wB);
    });

    it("shows today's workout when it has NOT been done today", () => {
      const schedule = [
        makeScheduleEntry(0, wA.id!),
        makeScheduleEntry(1, wB.id!),
        makeScheduleEntry(2, wA.id!),
      ];
      // Empty set — not done today
      const result = prioritizeScheduledWorkout(
        [wA, wB],
        schedule,
        0,
        false,
        new Set<number>(),
      );
      expect(result[0]).toBe(wA);
    });

    it("wraps around when today was done and remaining days this week are all rest", () => {
      // Mon = Workout A (done today), no other days scheduled this week.
      // Next scheduled is Mon again (next week, wraps around).
      const schedule = [makeScheduleEntry(0, wA.id!)];
      const completedTodayWorkoutIds = new Set<number>([wA.id!]);
      const result = prioritizeScheduledWorkout(
        [wA],
        schedule,
        0,
        false,
        completedTodayWorkoutIds,
      );
      // pinFirst on next Mon (the only scheduled day) — wA is still in uncompleted,
      // so it gets pinned (it just isn't done yet for next occurrence).
      expect(result[0]).toBe(wA);
    });
  });
});

// ─── computeWeeklyTargets ─────────────────────────────────────────────────────

describe("computeWeeklyTargets", () => {
  const workouts = [makeWorkout(1), makeWorkout(2)];

  it("distributes weekly goal evenly when no schedule", () => {
    const { perWorkoutTarget } = computeWeeklyTargets(workouts, 4, null, 0);
    expect(perWorkoutTarget.get(1)).toBe(2);
    expect(perWorkoutTarget.get(2)).toBe(2);
  });

  it("distributes remainder workouts when goal is not evenly divisible", () => {
    // 3 workouts, weeklyGoal 5 → floor=1, first 2 get +1 extra → [2, 2, 1]
    const ws = [makeWorkout(1), makeWorkout(2), makeWorkout(3)];
    const { perWorkoutTarget } = computeWeeklyTargets(ws, 5, null, 0);
    expect(perWorkoutTarget.get(1)).toBe(2);
    expect(perWorkoutTarget.get(2)).toBe(2);
    expect(perWorkoutTarget.get(3)).toBe(1);
  });

  it("uses schedule counts when schedule is provided", () => {
    const schedule = [
      makeScheduleEntry(0, 1),
      makeScheduleEntry(2, 1),
      makeScheduleEntry(4, 2),
    ];
    const { perWorkoutTarget } = computeWeeklyTargets(workouts, 4, schedule, 0);
    expect(perWorkoutTarget.get(1)).toBe(2);
    expect(perWorkoutTarget.get(2)).toBe(1);
  });

  it("marks today as rest day when not in schedule", () => {
    const schedule = [makeScheduleEntry(1, 1)]; // Only Tue
    const { isRestDay } = computeWeeklyTargets(workouts, 3, schedule, 0); // Today = Mon
    expect(isRestDay).toBe(true);
  });

  it("does not mark today as rest day when in schedule", () => {
    const schedule = [makeScheduleEntry(0, 1)]; // Mon
    const { isRestDay } = computeWeeklyTargets(workouts, 3, schedule, 0);
    expect(isRestDay).toBe(false);
  });

  it("ensures minimum target of 1 per workout when no schedule and goal is 0", () => {
    const { perWorkoutTarget } = computeWeeklyTargets(workouts, 0, null, 0);
    expect(perWorkoutTarget.get(1)).toBe(1);
    expect(perWorkoutTarget.get(2)).toBe(1);
  });
});
