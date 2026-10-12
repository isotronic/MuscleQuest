import { deloadWeekKey, isDeloadWeek } from "../deloadWeek";
import type { WeekRule } from "../week";

const MONDAY: WeekRule = { weekStartsOn: 1 };
const SUNDAY: WeekRule = { weekStartsOn: 0 };
// October 2026: Sunday 11, Monday 12, Saturday 17, Sunday 18. Local moments.
const at = (date: number, hour = 12) => new Date(2026, 9, date, hour);

describe("deloadWeekKey", () => {
  it("is the first day of the user's week", () => {
    expect(deloadWeekKey(at(14), MONDAY)).toBe("2026-10-12");
    expect(deloadWeekKey(at(14), SUNDAY)).toBe("2026-10-11");
  });
});

describe("isDeloadWeek", () => {
  it("covers the whole Sunday week, Sunday to Saturday", () => {
    const stored = deloadWeekKey(at(11), SUNDAY);
    expect(isDeloadWeek(stored, at(11, 8), SUNDAY)).toBe(true);
    expect(isDeloadWeek(stored, at(13), SUNDAY)).toBe(true);
    expect(isDeloadWeek(stored, at(17, 23), SUNDAY)).toBe(true);
    expect(isDeloadWeek(stored, at(18), SUNDAY)).toBe(false);
    expect(isDeloadWeek(stored, at(10), SUNDAY)).toBe(false);
  });

  it("still reads a deload stored as an ISO week before the change", () => {
    // 2026-W42 is Monday 12 to Sunday 18 October.
    expect(isDeloadWeek("2026-W42", at(12), SUNDAY)).toBe(true);
    expect(isDeloadWeek("2026-W42", at(18), SUNDAY)).toBe(true);
    expect(isDeloadWeek("2026-W42", at(11), SUNDAY)).toBe(false);
  });

  it("is never a deload week without a stored one", () => {
    expect(isDeloadWeek(null, at(12), MONDAY)).toBe(false);
    expect(isDeloadWeek(undefined, at(12), MONDAY)).toBe(false);
  });
});
