import {
  computeWeeklyTargets,
  planWorkoutsForWeek,
  prioritizeScheduledWorkout,
  rotateFromLast,
} from "../planHelpers";
import { isLocalDateInRange, toLocalDateKey } from "@/utils/dates";
import { endOfAppWeek, startOfAppWeek, type WeekRule } from "@/utils/week";
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
  it("has no per-workout targets without a schedule", () => {
    const { perWorkoutTarget, isRestDay } = computeWeeklyTargets(null, 0);
    expect(perWorkoutTarget.size).toBe(0);
    expect(isRestDay).toBe(false);
  });

  it("uses schedule counts when schedule is provided", () => {
    const schedule = [
      makeScheduleEntry(0, 1),
      makeScheduleEntry(2, 1),
      makeScheduleEntry(4, 2),
    ];
    const { perWorkoutTarget } = computeWeeklyTargets(schedule, 0);
    expect(perWorkoutTarget.get(1)).toBe(2);
    expect(perWorkoutTarget.get(2)).toBe(1);
  });

  it("marks today as rest day when not in schedule", () => {
    const schedule = [makeScheduleEntry(1, 1)]; // Only Tue
    const { isRestDay } = computeWeeklyTargets(schedule, 0); // Today = Mon
    expect(isRestDay).toBe(true);
  });

  it("does not mark today as rest day when in schedule", () => {
    const schedule = [makeScheduleEntry(0, 1)]; // Mon
    const { isRestDay } = computeWeeklyTargets(schedule, 0);
    expect(isRestDay).toBe(false);
  });
});

// ─── rotateFromLast ───────────────────────────────────────────────────────────

describe("rotateFromLast", () => {
  const ws = [makeWorkout(1), makeWorkout(2), makeWorkout(3)];
  const ids = (list: Workout[]) => list.map((w) => w.id);

  it("starts at the first workout when none was done yet", () => {
    expect(ids(rotateFromLast(ws, null))).toEqual([1, 2, 3]);
  });

  it("starts after the last workout and wraps around", () => {
    expect(ids(rotateFromLast(ws, 1))).toEqual([2, 3, 1]);
    expect(ids(rotateFromLast(ws, 3))).toEqual([1, 2, 3]);
  });

  it("starts at the first workout when the last one was deleted", () => {
    expect(ids(rotateFromLast(ws, 99))).toEqual([1, 2, 3]);
  });

  it("follows the current order after the plan was edited", () => {
    const edited = [makeWorkout(3), makeWorkout(1), makeWorkout(2)];
    expect(ids(rotateFromLast(edited, 1))).toEqual([2, 3, 1]);
  });
});

// ─── planWorkoutsForWeek ──────────────────────────────────────────────────────

describe("planWorkoutsForWeek", () => {
  // Local moments, so the day keys and weeks hold in any TZ. October 2026:
  // Monday 12, Wednesday 14, Friday 16, Monday 19, Wednesday 21.
  const at = (date: number) => new Date(2026, 9, date, 12);
  const MONDAY: WeekRule = { weekStartsOn: 1 };
  const A = makeWorkout(1);
  const B = makeWorkout(2);

  /** Home's view on `today` after the given sessions, oldest first. */
  function homeOn(today: number, done: { workout_id: number; day: number }[]) {
    const sessions = done.map((d) => ({
      workout_id: d.workout_id,
      local_date: toLocalDateKey(at(d.day)),
    }));
    const from = startOfAppWeek(at(today), MONDAY);
    const to = endOfAppWeek(at(today), MONDAY);
    const result = planWorkoutsForWeek({
      workouts: [A, B],
      schedule: null,
      todayDow: (at(today).getDay() + 6) % 7,
      todayKey: toLocalDateKey(at(today)),
      sessionsThisWeek: sessions.filter((s) =>
        isLocalDateInRange(s.local_date, from, to),
      ),
      lastWorkoutId: done.at(-1)?.workout_id ?? null,
    });
    return {
      order: result.workouts.map((w) => w.id),
      done: [...result.doneIds].sort(),
    };
  }

  it("rotates an unscheduled plan in order", () => {
    expect(homeOn(12, [])).toEqual({ order: [1, 2], done: [] });
    expect(homeOn(14, [{ workout_id: 1, day: 12 }])).toEqual({
      order: [2, 1],
      done: [1],
    });
    expect(
      homeOn(16, [
        { workout_id: 1, day: 12 },
        { workout_id: 2, day: 14 },
      ]),
    ).toEqual({ order: [1, 2], done: [1, 2] });
  });

  it("carries the rotation across a week boundary", () => {
    // A, B, A in week one: week two starts with B, nothing done yet.
    const weekOne = [
      { workout_id: 1, day: 12 },
      { workout_id: 2, day: 14 },
      { workout_id: 1, day: 16 },
    ];
    expect(homeOn(19, weekOne)).toEqual({ order: [2, 1], done: [] });
    expect(homeOn(21, [...weekOne, { workout_id: 2, day: 19 }])).toEqual({
      order: [1, 2],
      done: [2],
    });
  });

  it("keeps target ordering for a scheduled plan", () => {
    const schedule = [makeScheduleEntry(0, 1), makeScheduleEntry(2, 2)];
    const result = planWorkoutsForWeek({
      workouts: [A, B],
      schedule,
      todayDow: 2,
      todayKey: "2026-10-14",
      sessionsThisWeek: [{ workout_id: 1, local_date: "2026-10-12" }],
      lastWorkoutId: 1,
    });
    expect(result.workouts.map((w) => w.id)).toEqual([2, 1]);
    expect([...result.doneIds]).toEqual([1]);
    expect(result.isRestDay).toBe(false);
  });
});
