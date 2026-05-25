import { groupMeasurementsByTime } from "../BodyMeasurementLineChart";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("react-native-gifted-charts", () => ({}));
jest.mock("@/components/ThemedText", () => ({ ThemedText: () => null }));
jest.mock("@/constants/Colors", () => ({
  Colors: { dark: { tint: "#fff", subText: "#aaa" } },
}));
jest.mock("../chartTheme", () => ({
  chartTheme: { areaStartFill: "rgba(0,0,0,0)" },
}));

// Fix time to a known Monday so week-alignment is predictable.
// 2026-05-25 is a Monday.
const FIXED_NOW = new Date("2026-05-25T12:00:00.000Z");

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

const pt = (dateStr: string, value: number) => ({
  recorded_at: dateStr,
  displayValue: value,
});

describe("groupMeasurementsByTime — 30d", () => {
  it("returns empty buckets when no data points provided", () => {
    const result = groupMeasurementsByTime([], "30");
    expect(result.every((b) => !b.hasData)).toBe(true);
  });

  it("maps a point to the correct weekly bucket", () => {
    // 2026-05-20 is a Wednesday; its Monday week-start is 2026-05-18
    const result = groupMeasurementsByTime(
      [pt("2026-05-20T00:00:00Z", 75)],
      "30",
    );
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(75);
  });

  it("most recent value wins when multiple points fall in the same week", () => {
    const points = [
      pt("2026-05-18T00:00:00Z", 74), // Monday
      pt("2026-05-20T00:00:00Z", 75), // Wednesday — later, should win
    ];
    const result = groupMeasurementsByTime(points, "30");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(75);
  });

  it("produces separate buckets for points in different weeks", () => {
    const points = [
      pt("2026-05-04T00:00:00Z", 74), // week of Apr 27
      pt("2026-05-18T00:00:00Z", 75), // week of May 18
    ];
    const result = groupMeasurementsByTime(points, "30");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(2);
  });

  it("drops points outside the 30d window", () => {
    // 2026-04-01 is well outside a 30d window ending 2026-05-25
    const result = groupMeasurementsByTime(
      [pt("2026-04-01T00:00:00Z", 70)],
      "30",
    );
    expect(result.every((b) => !b.hasData)).toBe(true);
  });

  it("labels are day+month format for 30d", () => {
    const result = groupMeasurementsByTime(
      [pt("2026-05-20T00:00:00Z", 75)],
      "30",
    );
    const filled = result.filter((b) => b.hasData);
    // Label should contain a number (day) — format is e.g. "18 May"
    expect(filled[0].label).toMatch(/\d+/);
    expect(filled[0].labelLine2).toBeUndefined();
  });
});

describe("groupMeasurementsByTime — 90d", () => {
  it("maps a point to the correct week bucket", () => {
    const result = groupMeasurementsByTime(
      [pt("2026-05-20T00:00:00Z", 75)],
      "90",
    );
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(75);
  });

  it("labels are split across label and labelLine2 for 90d", () => {
    const result = groupMeasurementsByTime(
      [pt("2026-05-20T00:00:00Z", 75)],
      "90",
    );
    const filled = result.filter((b) => b.hasData);
    // 90d: label is day number, labelLine2 is month abbreviation
    expect(filled[0].label).toMatch(/^\d+$/);
    expect(filled[0].labelLine2).toBeDefined();
  });
});

describe("groupMeasurementsByTime — 365d", () => {
  it("maps points to monthly buckets", () => {
    const points = [
      pt("2026-01-15T00:00:00Z", 80),
      pt("2026-03-10T00:00:00Z", 78),
    ];
    const result = groupMeasurementsByTime(points, "365");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(2);
  });

  it("most recent value wins within a month", () => {
    const points = [
      pt("2026-05-01T00:00:00Z", 80),
      pt("2026-05-20T00:00:00Z", 78), // later in same month
    ];
    const result = groupMeasurementsByTime(points, "365");
    const mayBucket = result.filter((b) => b.hasData);
    // Both land in May — only one bucket with the later value
    expect(mayBucket).toHaveLength(1);
    expect(mayBucket[0].value).toBe(78);
  });

  it("drops points older than one year", () => {
    const result = groupMeasurementsByTime(
      [pt("2024-01-01T00:00:00Z", 85)],
      "365",
    );
    expect(result.every((b) => !b.hasData)).toBe(true);
  });
});

describe("groupMeasurementsByTime — all-time (0)", () => {
  it("returns empty array when no points provided", () => {
    expect(groupMeasurementsByTime([], "0")).toEqual([]);
  });

  it("uses monthly buckets for span <= 1 year", () => {
    const points = [
      pt("2026-01-10T00:00:00Z", 82),
      pt("2026-04-10T00:00:00Z", 80),
    ];
    const result = groupMeasurementsByTime(points, "0");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(2);
    // Monthly buckets have no labelLine2
    expect(filled[0].labelLine2).toBeUndefined();
  });

  it("uses quarterly buckets for span between 1-3 years", () => {
    const points = [
      pt("2024-01-10T00:00:00Z", 85),
      pt("2025-07-10T00:00:00Z", 80),
    ];
    const result = groupMeasurementsByTime(points, "0");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(2);
    // Quarterly buckets have labelLine2 (the year)
    filled.forEach((b) => expect(b.labelLine2).toBeDefined());
    // Labels should be Q1-Q4
    filled.forEach((b) => expect(b.label).toMatch(/^Q[1-4]$/));
  });

  it("uses yearly buckets for span > 3 years", () => {
    const points = [
      pt("2020-06-01T00:00:00Z", 90),
      pt("2024-06-01T00:00:00Z", 82),
    ];
    const result = groupMeasurementsByTime(points, "0");
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(2);
    // Yearly bucket labels are the year itself
    filled.forEach((b) => expect(b.label).toMatch(/^\d{4}$/));
  });

  it("single data point produces exactly one filled bucket", () => {
    const result = groupMeasurementsByTime(
      [pt("2026-03-15T00:00:00Z", 79)],
      "0",
    );
    const filled = result.filter((b) => b.hasData);
    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(79);
  });
});

describe("groupMeasurementsByTime — unknown timeRange", () => {
  it("returns empty array for unrecognised timeRange", () => {
    expect(
      groupMeasurementsByTime([pt("2026-05-01T00:00:00Z", 80)], "999"),
    ).toEqual([]);
  });
});
