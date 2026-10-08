import { getCurrentISOWeek, getISOWeek } from "../isoWeek";

describe("getISOWeek", () => {
  it("puts a Sunday night in the week that started the Monday before", () => {
    // Sunday 2026-03-08 23:30 local, then Monday 2026-03-09 local.
    expect(getISOWeek(new Date(2026, 2, 8, 23, 30))).toBe("2026-W10");
    expect(getISOWeek(new Date(2026, 2, 9, 0, 30))).toBe("2026-W11");
  });

  it("uses the ISO year at a year boundary", () => {
    // Thursday 2026-01-01 is in week 1 of 2026; Monday 2025-12-29 too.
    expect(getISOWeek(new Date(2025, 11, 29, 12))).toBe("2026-W01");
  });

  it("matches getCurrentISOWeek for now", () => {
    expect(getISOWeek(new Date())).toBe(getCurrentISOWeek());
  });
});
