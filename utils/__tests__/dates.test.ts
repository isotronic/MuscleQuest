import {
  parseDbTimestamp,
  toLocalDateKey,
  nowForDb,
  isLocalDateInRange,
  localDateKeyToDate,
  localDateKeyDaysAgo,
} from "@/utils/dates";

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

describe("isLocalDateInRange", () => {
  const monday = new Date(2026, 7, 10, 9, 0);
  const sunday = new Date(2026, 7, 16, 21, 0);

  it("includes a day at the start of the range", () => {
    expect(isLocalDateInRange("2026-08-10", monday, sunday)).toBe(true);
  });

  it("includes a day at the end of the range, whatever the time of day", () => {
    expect(isLocalDateInRange("2026-08-16", monday, sunday)).toBe(true);
  });

  it("excludes the day before the range", () => {
    expect(isLocalDateInRange("2026-08-09", monday, sunday)).toBe(false);
  });

  it("excludes the day after the range", () => {
    expect(isLocalDateInRange("2026-08-17", monday, sunday)).toBe(false);
  });

  it("treats a missing local_date as outside the range", () => {
    expect(isLocalDateInRange("", monday, sunday)).toBe(false);
  });
});

describe("localDateKeyToDate", () => {
  it("returns local midnight on that calendar day, not a UTC instant", () => {
    const d = localDateKeyToDate("2026-08-13");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips through toLocalDateKey", () => {
    expect(toLocalDateKey(localDateKeyToDate("2026-01-05"))).toBe("2026-01-05");
    expect(toLocalDateKey(localDateKeyToDate("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("localDateKeyDaysAgo", () => {
  it("returns today's key for 0", () => {
    expect(localDateKeyDaysAgo(0)).toBe(toLocalDateKey(new Date()));
  });

  it("counts back whole local calendar days", () => {
    const expected = new Date();
    expected.setDate(expected.getDate() - 30);
    expect(localDateKeyDaysAgo(30)).toBe(toLocalDateKey(expected));
  });

  it("crosses a month boundary", () => {
    const d = localDateKeyDaysAgo(365);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d < toLocalDateKey(new Date())).toBe(true);
  });
});

describe("parseDbTimestamp on absent values", () => {
  it("returns an invalid date rather than throwing on null", () => {
    expect(isNaN(parseDbTimestamp(null as unknown as string).getTime())).toBe(
      true,
    );
  });

  it("returns an invalid date rather than throwing on undefined", () => {
    expect(
      isNaN(parseDbTimestamp(undefined as unknown as string).getTime()),
    ).toBe(true);
  });

  it("returns an invalid date for an unparseable string", () => {
    expect(isNaN(parseDbTimestamp("not a date").getTime())).toBe(true);
  });
});
