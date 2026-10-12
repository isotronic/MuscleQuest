import { addDays } from "date-fns";
import { localDateKeyToDate, toLocalDateKey } from "@/utils/dates";
import {
  changeWeekStart,
  countTrainingDaysInWeek,
  endOfAppWeek,
  previousWeekStartKey,
  startOfAppWeek,
  weekDayOrder,
  weekEndKey,
  weekRuleFromSettings,
  weekRuleToSettings,
  weekStartKeyFor,
  type WeekRule,
} from "../week";

// Fixtures are local moments, so the day keys hold in any TZ. October 2026:
// Sunday 11, Monday 12, Wednesday 14, Sunday 18, Monday 19.
const at = (date: number, hour = 12) => new Date(2026, 9, date, hour);
const key = (date: number) => toLocalDateKey(at(date));

const MONDAY: WeekRule = { weekStartsOn: 1 };
const SUNDAY: WeekRule = { weekStartsOn: 0 };

/** Walks every day of a range and groups it by week start. */
function weeksOver(rule: WeekRule, fromDate: number, days: number) {
  const weeks = new Map<string, string[]>();
  for (let i = 0; i < days; i++) {
    const day = toLocalDateKey(addDays(at(fromDate), i));
    const start = weekStartKeyFor(day, rule);
    weeks.set(start, [...(weeks.get(start) ?? []), day]);
  }
  return weeks;
}

function expectContiguous(rule: WeekRule, fromDate: number, days: number) {
  const weeks = [...weeksOver(rule, fromDate, days).entries()];
  for (let i = 0; i < weeks.length; i++) {
    const [start, members] = weeks[i];
    // Every day of a week sits between its start and end, in order, and the
    // next week starts the day after this one ends.
    const end = weekEndKey(start, rule);
    if (i > 0) expect(members[0]).toBe(start);
    if (i < weeks.length - 1) {
      expect(members[members.length - 1]).toBe(end);
      const nextStart = weeks[i + 1][0];
      expect(toLocalDateKey(addDays(localDateKeyToDate(end), 1))).toBe(
        nextStart,
      );
      expect(previousWeekStartKey(nextStart, rule)).toBe(start);
    }
  }
}

describe("week rule without a change", () => {
  it("starts on Monday or Sunday", () => {
    expect(weekStartKeyFor(key(14), MONDAY)).toBe(key(12));
    expect(weekStartKeyFor(key(14), SUNDAY)).toBe(key(11));
    expect(weekEndKey(key(12), MONDAY)).toBe(key(18));
    expect(weekEndKey(key(11), SUNDAY)).toBe(key(17));
  });

  it("gives Date bounds at local midnight and end of day", () => {
    expect(startOfAppWeek(at(14, 23), MONDAY)).toEqual(new Date(2026, 9, 12));
    expect(endOfAppWeek(at(14, 1), MONDAY)).toEqual(
      new Date(2026, 9, 18, 23, 59, 59, 999),
    );
  });
});

describe("changeWeekStart", () => {
  it("Monday to Sunday: a six-day transition week, then Sunday weeks", () => {
    const rule = changeWeekStart(MONDAY, 0, at(14));
    expect(rule).toEqual({ weekStartsOn: 0, previous: 1, from: key(18) });
    // The running week keeps its Monday start and ends on Saturday.
    expect(weekStartKeyFor(key(14), rule)).toBe(key(12));
    expect(weekEndKey(key(12), rule)).toBe(key(17));
    expect(weekStartKeyFor(key(17), rule)).toBe(key(12));
    expect(weekStartKeyFor(key(18), rule)).toBe(key(18));
    // Earlier weeks are untouched.
    expect(weekStartKeyFor(key(8), rule)).toBe(toLocalDateKey(at(5)));
    expectContiguous(rule, 1, 30);
  });

  it("Sunday to Monday: an eight-day transition week, then Monday weeks", () => {
    const rule = changeWeekStart(SUNDAY, 1, at(14));
    expect(rule).toEqual({ weekStartsOn: 1, previous: 0, from: key(19) });
    expect(weekStartKeyFor(key(14), rule)).toBe(key(11));
    expect(weekStartKeyFor(key(18), rule)).toBe(key(11));
    expect(weekEndKey(key(11), rule)).toBe(key(18));
    expect(weekStartKeyFor(key(19), rule)).toBe(key(19));
    expect(weekStartKeyFor(key(10), rule)).toBe(toLocalDateKey(at(4)));
    expectContiguous(rule, 1, 30);
  });

  it("keeps the running Monday week whole when changed on its Sunday", () => {
    const rule = changeWeekStart(MONDAY, 0, at(18));
    // Sunday 18 stays the last day of the Monday 12 week; the six-day
    // transition week follows, then Sunday weeks from 25.
    expect(weekStartKeyFor(key(18), rule)).toBe(key(12));
    expect(weekEndKey(key(12), rule)).toBe(key(18));
    expect(weekStartKeyFor(key(19), rule)).toBe(key(19));
    expect(weekEndKey(key(19), rule)).toBe(key(24));
    expect(rule.from).toBe(key(25));
    expectContiguous(rule, 1, 40);
  });

  it("gives the same transition whichever day of the week it is changed on", () => {
    for (let date = 12; date <= 17; date++) {
      expect(changeWeekStart(MONDAY, 0, at(date)).from).toBe(key(18));
    }
    for (let date = 11; date <= 17; date++) {
      expect(changeWeekStart(SUNDAY, 1, at(date)).from).toBe(key(19));
    }
  });

  it("undoes a change that has not started yet", () => {
    const pending = changeWeekStart(MONDAY, 0, at(14));
    expect(changeWeekStart(pending, 1, at(15))).toEqual({ weekStartsOn: 1 });
    expect(changeWeekStart(pending, 0, at(15))).toBe(pending);
  });

  it("keeps the rule when the same start is picked", () => {
    expect(changeWeekStart(MONDAY, 1, at(14))).toBe(MONDAY);
  });

  it("starts from the rule in effect after an earlier change", () => {
    const first = changeWeekStart(MONDAY, 0, at(14));
    const second = changeWeekStart(first, 1, at(28));
    // The running week (Sunday 25) keeps its start; Monday weeks resume after.
    expect(second).toEqual({
      weekStartsOn: 1,
      previous: 0,
      from: toLocalDateKey(new Date(2026, 10, 2, 12)),
    });
    expect(weekStartKeyFor(key(28), second)).toBe(key(25));
    expectContiguous(second, 19, 30);
  });
});

describe("settings round trip", () => {
  it("reads and writes the three settings", () => {
    const rule = changeWeekStart(MONDAY, 0, at(14));
    expect(weekRuleFromSettings(weekRuleToSettings(rule))).toEqual(rule);
    expect(weekRuleToSettings(MONDAY)).toEqual({
      weekStartsOn: "1",
      weekStartsOnPrevious: "",
      weekStartsOnFrom: "",
    });
  });

  it("defaults to Monday weeks", () => {
    expect(weekRuleFromSettings(undefined)).toEqual(MONDAY);
    expect(weekRuleFromSettings({ weekStartsOn: "6" })).toEqual(MONDAY);
  });
});

describe("weekDayOrder", () => {
  it("lists 0 = Monday indices from the week start", () => {
    expect(weekDayOrder(1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekDayOrder(0)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});

describe("countTrainingDaysInWeek", () => {
  it("counts the transition week's own days only", () => {
    const rule = changeWeekStart(SUNDAY, 1, at(14));
    const workouts = [11, 13, 18, 18, 19].map((d) => ({ local_date: key(d) }));
    expect(countTrainingDaysInWeek(workouts, key(11), rule)).toBe(3);
    expect(countTrainingDaysInWeek(workouts, key(19), rule)).toBe(1);
  });
});
