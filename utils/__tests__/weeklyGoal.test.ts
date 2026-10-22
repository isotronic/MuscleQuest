import { reachedGoalWithWorkout, trainingDaysThisWeek } from "../weeklyGoal";
import { toLocalDateKey } from "@/utils/dates";
import { DEFAULT_WEEK_RULE as MONDAY } from "@/utils/week";

// Wednesday 7 October 2026, late evening local time: the week runs Monday
// 5 to Sunday 11 October wherever the test runs.
const today = new Date(2026, 9, 7, 23, 30);
const day = (date: number) => toLocalDateKey(new Date(2026, 9, date, 12));

const workout = { id: 10, local_date: day(7) };

describe("reachedGoalWithWorkout", () => {
  it("is true when this workout's day is the one that reaches the goal", () => {
    const history = [
      { id: 1, local_date: day(5) },
      { id: 2, local_date: day(6) },
    ];
    expect(reachedGoalWithWorkout(workout, history, 3, MONDAY, today)).toBe(
      true,
    );
    // Also when the history already holds the workout itself.
    expect(
      reachedGoalWithWorkout(workout, [...history, workout], 3, MONDAY, today),
    ).toBe(true);
  });

  it("is false short of the goal, past it, or on a day already counted", () => {
    const history = [
      { id: 1, local_date: day(5) },
      { id: 2, local_date: day(6) },
    ];
    expect(reachedGoalWithWorkout(workout, history, 4, MONDAY, today)).toBe(
      false,
    );
    expect(reachedGoalWithWorkout(workout, history, 2, MONDAY, today)).toBe(
      false,
    );
    expect(
      reachedGoalWithWorkout(
        workout,
        [
          { id: 1, local_date: day(5) },
          { id: 3, local_date: day(7) },
        ],
        3,
        MONDAY,
        today,
      ),
    ).toBe(false);
  });

  it("does not count last week's days or a workout saved to last week", () => {
    const history = [
      { id: 1, local_date: day(4) }, // Sunday of last week
      { id: 2, local_date: day(6) },
    ];
    expect(reachedGoalWithWorkout(workout, history, 3, MONDAY, today)).toBe(
      false,
    );
    expect(
      reachedGoalWithWorkout(
        { id: 10, local_date: day(4) },
        [],
        1,
        MONDAY,
        today,
      ),
    ).toBe(false);
  });

  it("is false without a goal", () => {
    expect(reachedGoalWithWorkout(workout, [], 0, MONDAY, today)).toBe(false);
  });
});

describe("trainingDaysThisWeek", () => {
  // Sunday 11 October 2026, 23:30 local: still the week of Monday 5 October.
  const sundayNight = new Date(2026, 9, 11, 23, 30);

  it("counts distinct training days in the current week", () => {
    const history = [
      { local_date: day(5) },
      { local_date: day(5) },
      { local_date: day(11) },
    ];
    expect(trainingDaysThisWeek(history, MONDAY, sundayNight)).toBe(2);
  });

  it("leaves out last week's sessions", () => {
    const history = [{ local_date: day(4) }, { local_date: day(9) }];
    expect(trainingDaysThisWeek(history, MONDAY, sundayNight)).toBe(1);
  });
});
