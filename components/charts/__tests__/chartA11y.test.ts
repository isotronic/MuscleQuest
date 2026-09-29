import {
  summarizeShares,
  summarizeTotals,
  summarizeTrend,
  timeRangePhrase,
} from "../chartA11y";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));

describe("timeRangePhrase", () => {
  it("spells out each selector value", () => {
    expect(timeRangePhrase("30")).toBe("last 30 days");
    expect(timeRangePhrase("90")).toBe("last 90 days");
    expect(timeRangePhrase("365")).toBe("last year");
    expect(timeRangePhrase("0")).toBe("all time");
  });
});

describe("summarizeTrend", () => {
  const base = { title: "Bench Press 1RM", timeRange: "90", unit: "kg" };

  it("reports the start, end and an upward trend", () => {
    expect(
      summarizeTrend({
        ...base,
        values: [80, null, 85, 90, 95],
      }),
    ).toBe("Bench Press 1RM, last 90 days: from 80 to 95 kg, trending up.");
  });

  it("reports a downward trend", () => {
    expect(summarizeTrend({ ...base, values: [100, 92.5] })).toBe(
      "Bench Press 1RM, last 90 days: from 100 to 92.5 kg, trending down.",
    );
  });

  it("calls small changes steady", () => {
    expect(summarizeTrend({ ...base, values: [100, 101] })).toBe(
      "Bench Press 1RM, last 90 days: from 100 to 101 kg, holding steady.",
    );
  });

  it("reads a single point as one value", () => {
    expect(summarizeTrend({ ...base, values: [null, 82.25] })).toBe(
      "Bench Press 1RM, last 90 days: 82.3 kg.",
    );
  });

  it("works without a unit", () => {
    expect(
      summarizeTrend({ ...base, title: "Reps", unit: "", values: [8, 12] }),
    ).toBe("Reps, last 90 days: from 8 to 12, trending up.");
  });

  it("says when there is nothing to show", () => {
    expect(summarizeTrend({ ...base, values: [null, null] })).toBe(
      "Bench Press 1RM, last 90 days: no data in this period.",
    );
  });
});

describe("summarizeTotals", () => {
  const base = {
    title: "Workouts",
    timeRange: "90",
    emptyText: "No workouts in this period",
  };

  it("gives the total and the busiest bucket", () => {
    expect(
      summarizeTotals({
        ...base,
        buckets: [
          { label: "Jul", value: 3 },
          { label: "Aug", value: 9 },
          { label: "Sep", value: 6 },
        ],
      }),
    ).toBe("Workouts, last 90 days: 18 in total, most in Aug with 9.");
  });

  it("formats values with the given unit", () => {
    expect(
      summarizeTotals({
        ...base,
        title: "Volume",
        unit: "kg",
        buckets: [
          { label: "Q1", value: 1200.4 },
          { label: "Q2", value: 800 },
        ],
      }),
    ).toBe(
      "Volume, last 90 days: 2000.4 kg in total, most in Q1 with 1200.4 kg.",
    );
  });

  it("uses the empty text when every bucket is zero", () => {
    expect(
      summarizeTotals({
        ...base,
        buckets: [
          { label: "Jul", value: 0 },
          { label: "Aug", value: 0 },
        ],
      }),
    ).toBe("Workouts, last 90 days: No workouts in this period.");
  });
});

describe("summarizeShares", () => {
  it("lists each share, largest first", () => {
    expect(
      summarizeShares({
        title: "Sets by body part",
        shares: [
          { name: "back", percent: 30 },
          { name: "chest", percent: 45.5 },
          { name: "legs", percent: 24.5 },
        ],
        emptyText: "No workouts in this period",
      }),
    ).toBe("Sets by body part: chest 45.5%, back 30%, legs 24.5%.");
  });

  it("uses the empty text with no shares", () => {
    expect(
      summarizeShares({
        title: "Sets by body part",
        shares: [],
        emptyText: "No workouts in this period",
      }),
    ).toBe("Sets by body part: No workouts in this period.");
  });
});
