import { todayHero } from "../homeToday";
import { planWorkoutsForWeek } from "../planHelpers";
import { toLocalDateKey } from "../dates";
import type { Workout } from "@/store/workoutStore";
import type { PlanScheduleEntry } from "@/utils/database";

const workout = (id: number, name: string): Workout => ({
  id,
  name,
  exercises: [],
});
const push = workout(1, "Push");
const pull = workout(2, "Pull");
const legs = workout(3, "Legs");
const workouts = [push, pull, legs];

// A local Wednesday morning: day keys come from local moments so the test
// holds under any TZ.
const today = new Date(2026, 9, 14, 8, 0, 0);
const todayKey = toLocalDateKey(today);
const todayDow = 2; // Wed
const daysAgoKey = (n: number) =>
  toLocalDateKey(new Date(2026, 9, 14 - n, 23, 30, 0));

function heroFor({
  schedule,
  sessions = [],
  lastWorkoutId = null,
  doneToday = false,
  planId = 7,
}: {
  schedule?: PlanScheduleEntry[];
  sessions?: { workout_id: number; local_date: string }[];
  lastWorkoutId?: number | null;
  doneToday?: boolean;
  planId?: number | null;
}) {
  const week = planWorkoutsForWeek({
    workouts,
    schedule,
    todayDow,
    todayKey,
    sessionsThisWeek: sessions,
    lastWorkoutId,
  });
  return todayHero({
    planId,
    planWorkouts: workouts,
    orderedWorkouts: week.workouts,
    schedule,
    isRestDay: week.isRestDay,
    doneToday,
    todayDow,
    todayKey,
    recentSessions: sessions.map((s) => ({ ...s, plan_id: 7 })),
  });
}

describe("todayHero", () => {
  it("shows today's scheduled workout", () => {
    const hero = heroFor({
      schedule: [
        { day_of_week: 0, workout_id: 1 },
        { day_of_week: 2, workout_id: 2 },
        { day_of_week: 4, workout_id: 3 },
      ],
    });
    expect(hero).toMatchObject({
      kind: "workout",
      workout: { id: 2 },
      workoutIndex: 1,
      restDay: false,
      scheduledToday: true,
      nextDow: null,
    });
  });

  it("on a rest day shows the next scheduled workout and its day", () => {
    const hero = heroFor({
      schedule: [
        { day_of_week: 0, workout_id: 1 },
        { day_of_week: 3, workout_id: 2 },
        { day_of_week: 5, workout_id: 3 },
      ],
    });
    expect(hero).toMatchObject({
      kind: "workout",
      workout: { id: 2 },
      restDay: true,
      scheduledToday: false,
      nextDow: 3,
    });
  });

  it("without a schedule shows the next workout in rotation", () => {
    const hero = heroFor({
      lastWorkoutId: 2,
      sessions: [{ workout_id: 3, local_date: daysAgoKey(5) }],
    });
    expect(hero).toMatchObject({
      kind: "workout",
      workout: { id: 3 },
      restDay: false,
      scheduledToday: false,
      nextDow: null,
      lastDoneDaysAgo: 5,
    });
  });

  it("counts last done in calendar days from the latest session", () => {
    const hero = heroFor({
      lastWorkoutId: 3,
      sessions: [
        { workout_id: 1, local_date: daysAgoKey(9) },
        { workout_id: 1, local_date: daysAgoKey(1) },
        { workout_id: 2, local_date: todayKey },
      ],
    });
    expect(hero).toMatchObject({ workout: { id: 1 }, lastDoneDaysAgo: 1 });
  });

  it("has no last done when the workout is not in recent history", () => {
    expect(heroFor({})).toMatchObject({
      workout: { id: 1 },
      lastDoneDaysAgo: null,
    });
  });

  it("asks to pick a plan when there is none", () => {
    expect(heroFor({ planId: null })).toEqual({ kind: "noPlan" });
  });

  it("asks for workouts when the active plan has none", () => {
    expect(
      todayHero({
        planId: 7,
        planWorkouts: [],
        orderedWorkouts: [],
        schedule: [],
        isRestDay: false,
        // Even after a quick workout today.
        doneToday: true,
        todayDow,
        todayKey,
        recentSessions: [],
      }),
    ).toEqual({ kind: "emptyPlan" });
  });

  it("is done once a workout was logged today", () => {
    expect(heroFor({ doneToday: true })).toEqual({ kind: "done" });
  });
});
