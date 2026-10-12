import { groupWorkoutsByTime } from "../TrendBarChart";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("react-native-gifted-charts", () => ({}));
jest.mock("../chartTheme", () => ({ useChartTheme: () => ({}) }));

// Monday 25 May 2026, local noon.
const FIXED_NOW = new Date(2026, 4, 25, 12, 0, 0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});
afterEach(() => jest.useRealTimers());

describe("groupWorkoutsByTime", () => {
  it("starts weekly buckets on the user's week start", () => {
    // Sunday 24 May belongs to the week of Monday 18, or starts its own.
    const workouts = [{ local_date: "2026-05-24" }];
    const monday = groupWorkoutsByTime(workouts, "30");
    expect(monday.find((b) => b.value > 0)?.label).toMatch(/^18 /);
    const sunday = groupWorkoutsByTime(workouts, "30", () => 1, 0);
    expect(sunday.find((b) => b.value > 0)?.label).toMatch(/^24 /);
  });
});
