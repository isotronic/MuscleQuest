import { toLocalDateKey } from "@/utils/dates";
import { mondayIndex, startOfAppWeek } from "@/utils/week";
import { history, resolveSessions, scheduleDays } from "../history";

// Monday 12 October 2026 to Sunday 18 October.
const days = Array.from(
  { length: 7 },
  (_, i) => new Date(2026, 9, 12 + i, 12, 0),
);

const thisWeek = (today: Date) => {
  const start = toLocalDateKey(startOfAppWeek(today, { weekStartsOn: 1 }));
  return resolveSessions(today).filter((s) => s.localDate >= start);
};

it.each(days.map((d) => [d.toDateString(), d] as const))(
  "on %s, today is a training day and this week is on track",
  (_label, today) => {
    expect(scheduleDays(today, history.scheduleByWeekday)).toContain(
      mondayIndex(today),
    );
    // Two done from Wednesday on; Monday and Tuesday cannot have two yet.
    const expected = [0, 1, 2, 2, 2, 2, 3][mondayIndex(today)];
    expect(thisWeek(today)).toHaveLength(expected);
  },
);

it("never logs a session today or later", () => {
  for (const today of days) {
    const todayKey = toLocalDateKey(today);
    for (const s of resolveSessions(today)) {
      expect(s.localDate < todayKey).toBe(true);
      expect(s.end.getTime()).toBeLessThan(today.getTime());
    }
  }
});

it("misses one session in week 5 and deloads in week 6", () => {
  const sessions = resolveSessions(days[2]);
  const perWeek = (week: number) => sessions.filter((s) => s.def.week === week);
  expect(perWeek(4)).toHaveLength(4);
  expect(perWeek(5)).toHaveLength(3);
  expect(perWeek(6).every((s) => s.isDeload)).toBe(true);
  expect(perWeek(7).some((s) => s.isDeload)).toBe(false);
});

it("keeps sessions between 45 and 75 minutes", () => {
  for (const s of history.sessions) {
    expect(s.minutes).toBeGreaterThanOrEqual(45);
    expect(s.minutes).toBeLessThanOrEqual(75);
  }
});
