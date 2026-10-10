import React from "react";
import { render } from "@testing-library/react-native";
import { ExerciseProgressTab } from "../ExerciseProgressTab";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
jest.mock("@/components/stats/TimeRangeSelector", () => ({
  TimeRangeSelector: () => null,
}));
jest.mock("@/components/charts/ExerciseProgressionChart", () => ({
  ExerciseProgressionChart: () => null,
}));
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));

let mockSettings: Record<string, string> = {};
let mockDetail: any = null;
let mockHistory: any = null;

jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
jest.mock("@/hooks/useExerciseDetailQuery", () => ({
  useExerciseDetailQuery: () => ({ data: mockDetail, isLoading: false }),
}));
jest.mock("@/hooks/useExerciseHistoryQuery", () => ({
  useExerciseHistoryQuery: () => ({ data: mockHistory, isLoading: false }),
}));

const set = (weight: number, reps: number, date: string, e1rm: number) => ({
  set_number: 1,
  weight,
  reps,
  time: undefined,
  distance: undefined,
  date_completed: date,
  oneRepMax: e1rm,
  progressionMetric: e1rm,
});

const historySet = (
  id: number,
  weight: number,
  reps: number,
  isPR = false,
) => ({
  id,
  set_number: id,
  weight,
  reps,
  time: null,
  distance: null,
  hist_bw_kg: null,
  is_warmup: false,
  is_pr: isPR,
  note: null,
});

const texts = (getAllByText: any) =>
  getAllByText(/./).map((el: any) => [].concat(el.props.children).join(""));

describe("ExerciseProgressTab", () => {
  beforeEach(() => {
    mockSettings = { weightUnit: "kg", distanceUnit: "m", timeRange: "30" };
    mockHistory = {
      trackingType: "weight",
      sections: [
        { date: "Oct 2, 2026", workout_name: "A", workout_id: 2, data: [] },
        { date: "Oct 1, 2026", workout_name: "A", workout_id: 1, data: [] },
      ],
    };
    const latest = set(100, 5, "2026-10-02", 116.7);
    const best = set(110, 3, "2026-10-01", 121);
    mockDetail = {
      trackedExercise: { completed_sets: [latest, best] },
      allTimePR: 121,
      latestMetric: 116.7,
      trackingType: "weight",
      topPRSets: [best],
      recentSessions: [{ date_completed: "2026-10-02", bestSet: latest }],
      preRangeBaseline: null,
    };
  });

  it("shows the PR, latest and top set in the user's unit", () => {
    const { getAllByText } = render(<ExerciseProgressTab exerciseId={1} />);
    const shown = texts(getAllByText);
    expect(shown).toEqual(
      expect.arrayContaining([
        "121.0 kg",
        "116.7 kg",
        "110.0 kg × 3",
        "100.0 kg × 5  ·  1RM 116.7 kg",
      ]),
    );
    expect(shown.some((s: string) => s.startsWith("1RM 121.0 kg  ·  "))).toBe(
      true,
    );
  });

  it("converts to pounds when the user logs in pounds", () => {
    mockSettings.weightUnit = "lbs";
    const { getAllByText } = render(<ExerciseProgressTab exerciseId={1} />);
    expect(texts(getAllByText)).toContain("266.8 lbs");
  });

  it("asks for a second session and shows the best set from the first", () => {
    mockHistory.sections = [
      {
        date: "Oct 1, 2026",
        workout_name: "A",
        workout_id: 1,
        data: [historySet(1, 80, 8), historySet(2, 90, 5, true)],
      },
    ];
    const { getByText, queryByText } = render(
      <ExerciseProgressTab exerciseId={1} />,
    );
    expect(getByText("Log this exercise twice to see a trend")).toBeTruthy();
    expect(getByText("90 kg × 5")).toBeTruthy();
    expect(queryByText("All-time PR")).toBeNull();
  });
});
