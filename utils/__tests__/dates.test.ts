import { parseDbTimestamp, toLocalDateKey, nowForDb } from "@/utils/dates";

describe("parseDbTimestamp", () => {
  it("reads a SQLite datetime('now') value as UTC, not local time", () => {
    expect(parseDbTimestamp("2026-08-13 22:30:00").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0),
    );
  });

  it("reads a CURRENT_TIMESTAMP value with a T separator as UTC", () => {
    expect(parseDbTimestamp("2026-08-13T22:30:00").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0),
    );
  });

  it("honours an explicit Z", () => {
    expect(parseDbTimestamp("2026-08-13T22:30:00.000Z").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0),
    );
  });

  it("honours an explicit numeric offset", () => {
    expect(parseDbTimestamp("2026-08-14T08:30:00+10:00").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0),
    );
  });

  it("honours a numeric offset written without a colon", () => {
    expect(parseDbTimestamp("2026-08-14T08:30:00+1000").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0),
    );
  });

  it("keeps fractional seconds on a space-separated value", () => {
    expect(parseDbTimestamp("2026-08-13 22:30:00.250").getTime()).toBe(
      Date.UTC(2026, 7, 13, 22, 30, 0, 250),
    );
  });

  it("does not treat a bare date as a local-time value", () => {
    expect(parseDbTimestamp("2026-08-13").getTime()).toBe(
      Date.UTC(2026, 7, 13, 0, 0, 0),
    );
  });
});

describe("toLocalDateKey", () => {
  it("returns the device-local calendar date, not the UTC one", () => {
    // 2026-08-13 22:30 UTC. Under TZ=Pacific/Auckland (UTC+12) that is the 14th.
    const d = new Date(Date.UTC(2026, 7, 13, 22, 30, 0));
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(toLocalDateKey(d)).toBe(expected);
  });

  it("zero-pads single-digit months and days", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });
});

describe("nowForDb", () => {
  it("returns a UTC ISO instant and the matching local date key", () => {
    const { utc, localDate } = nowForDb();
    expect(utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(localDate).toBe(toLocalDateKey(parseDbTimestamp(utc)));
  });
});
