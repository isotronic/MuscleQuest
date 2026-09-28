// completed_sets rows carry date_completed as a local_date key ("YYYY-MM-DD"),
// the day the user trained. new Date("2026-05-20") is UTC midnight, which is
// the previous day west of UTC, so the chart must read the key as a local day.
import { groupSetsByTime } from "../ExerciseProgressionChart";
import type { CompletedSet } from "@/hooks/useTrackedExercisesQuery";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react/macro", () => ({ Trans: () => null }));
jest.mock("react-native-gifted-charts", () => ({}));
jest.mock("@/components/ThemedText", () => ({ ThemedText: () => null }));
jest.mock("../chartTheme", () => ({
  useChartTheme: () => ({
    areaStartFill: "rgba(0,0,0,0)",
    areaEndFill: "rgba(0,0,0,0)",
    pointerStripColor: "rgba(255,255,255,0.15)",
  }),
}));

// 2026-05-25 is a Monday. Local noon: the chart buckets by the local calendar.
const FIXED_NOW = new Date(2026, 4, 25, 12, 0, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterEach(() => jest.useRealTimers());

const set = (dateKey: string, metric: number): CompletedSet =>
  ({ date_completed: dateKey, progressionMetric: metric }) as CompletedSet;

describe("groupSetsByTime", () => {
  it("buckets a training day into the local week that contains it", () => {
    // 2026-05-18 is the Monday of the week before FIXED_NOW's. Read as UTC
    // midnight it becomes Sunday the 17th west of UTC: the previous bucket.
    const result = groupSetsByTime([set("2026-05-18", 100)], "30", "weight", 1);
    const filled = result.filter((b) => b.hasData);

    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(100);
    expect(filled[0].label).toBe("18 May");
  });

  it("buckets a training day into the local month that contains it", () => {
    // The 1st of a month is the previous month once read as UTC midnight.
    const result = groupSetsByTime([set("2026-05-01", 90)], "365", "weight", 1);
    const filled = result.filter((b) => b.hasData);

    expect(filled).toHaveLength(1);
    expect(filled[0].label).toBe("May");
  });

  it("keeps two days of the same local week in one bucket", () => {
    const result = groupSetsByTime(
      [set("2026-05-20", 105), set("2026-05-18", 100)],
      "30",
      "weight",
      1,
    );
    const filled = result.filter((b) => b.hasData);

    expect(filled).toHaveLength(1);
    expect(filled[0].value).toBe(105);
  });
});
