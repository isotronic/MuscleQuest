import React from "react";
import { render } from "@testing-library/react-native";
import StatsScreen from "../(tabs)/(stats)/index";
import {
  defaultStatsLayout,
  moveWidget,
  setWidgetVisible,
  type StatsLayout,
} from "@/utils/statsLayout";

let mockLayout: StatsLayout;

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray) => ({ id: s.join("") }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    refetchQueries: jest.fn(),
    invalidateQueries: jest.fn(),
  }),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({
    data: { weightUnit: "kg", timeRange: "30", weeklyGoal: "3" },
    isLoading: false,
  }),
}));
jest.mock("@/hooks/useStatsLayout", () => ({
  useStatsLayout: () => ({ layout: mockLayout, isLoading: false }),
}));
jest.mock("@/hooks/useWorkoutSummariesQuery", () => ({
  useWorkoutSummariesQuery: () => ({ data: [] }),
}));
jest.mock("@/hooks/useWeeklyStreak", () => ({
  useWeeklyStreak: () => ({ streak: 0 }),
}));
jest.mock("@/components/stats/WorkoutCalendarModal", () => ({
  WorkoutCalendarModal: () => null,
}));
jest.mock("@/components/stats/TimeRangeSelector", () => ({
  TimeRangeSelector: () => null,
}));
jest.mock("@/components/ui", () => ({ AppIconButton: () => null }));
// Each widget renders its id, so the test sees which ones mount and where.
jest.mock("@/components/stats/widgets/registry", () => {
  const { Text } = require("react-native");
  const ids = [
    "insights",
    "summary",
    "history",
    "recentPRs",
    "heatmap",
    "trendA",
    "trendB",
    "split",
    "muscleSets",
    "tracked",
    "measurements",
  ];
  return {
    WIDGETS: Object.fromEntries(
      ids.map((id) => [
        id,
        { Component: () => <Text testID="widget">{id}</Text> },
      ]),
    ),
  };
});

const shown = (getAllByTestId: (id: string) => { props: any }[]) =>
  getAllByTestId("widget").map((el) => el.props.children);

describe("StatsScreen", () => {
  it("renders the visible widgets in the saved order", () => {
    mockLayout = setWidgetVisible(
      moveWidget(defaultStatsLayout(), 9, 0),
      "heatmap",
      false,
    );
    const { getAllByTestId } = render(<StatsScreen />);
    const ids = shown(getAllByTestId);
    expect(ids[0]).toBe("tracked");
    expect(ids).not.toContain("heatmap");
    expect(ids).toHaveLength(10);
  });

  it("offers a way back when every widget is hidden", () => {
    mockLayout = {
      v: 1,
      widgets: defaultStatsLayout().widgets.map((w) => ({
        ...w,
        visible: false,
      })),
    };
    const { queryAllByTestId, getByText } = render(<StatsScreen />);
    expect(queryAllByTestId("widget")).toHaveLength(0);
    expect(getByText("Every section is hidden.")).toBeTruthy();
    expect(getByText("Customize")).toBeTruthy();
  });
});
