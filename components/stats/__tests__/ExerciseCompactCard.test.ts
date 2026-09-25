// The card labels a training day, and date_completed is a local_date key.
// Measuring elapsed milliseconds from new Date("2026-05-20") -- UTC midnight --
// makes an evening reading of today's own workout say "Yesterday" west of UTC.
import { formatDaysAgo } from "../ExerciseCompactCard";
import { toLocalDateKey } from "@/utils/dates";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
  plural: (n: number, o: Record<string, string>) =>
    (n === 1 ? o.one : o.other).replace("#", String(n)),
}));
jest.mock("@lingui/react/macro", () => ({ Trans: () => null }));
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("@/components/charts/SparklineChart", () => ({
  SparklineChart: () => null,
}));
jest.mock("react-native-sortables", () => ({}));

// Late evening local time: the point at which a UTC-midnight baseline has
// drifted more than a day west of UTC.
const FIXED_NOW = new Date(2026, 4, 20, 22, 30, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterEach(() => jest.useRealTimers());

const keyDaysAgo = (n: number) => {
  const d = new Date(FIXED_NOW);
  d.setDate(d.getDate() - n);
  return toLocalDateKey(d);
};

describe("formatDaysAgo", () => {
  it("calls a workout trained earlier today Today", () => {
    expect(formatDaysAgo(keyDaysAgo(0))).toBe("Today");
  });

  it("calls yesterday's workout Yesterday", () => {
    expect(formatDaysAgo(keyDaysAgo(1))).toBe("Yesterday");
  });

  it("counts whole calendar days within the week", () => {
    expect(formatDaysAgo(keyDaysAgo(3))).toBe("3 days ago");
  });

  it("switches to weeks after seven days", () => {
    expect(formatDaysAgo(keyDaysAgo(14))).toBe("2 weeks ago");
  });

  it("reports an unparseable value as unknown", () => {
    expect(formatDaysAgo("")).toBe("Unknown");
  });
});
