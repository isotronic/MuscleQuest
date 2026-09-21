import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MeasurementQuickLogCard } from "../MeasurementQuickLogCard";
import type {
  BodyMetricDefinition,
  BodyMeasurementSession,
} from "@/utils/database";

const WEIGHT: BodyMetricDefinition = {
  id: 1,
  key: "weight",
  label: "Body Weight",
  value_kind: "mass",
  is_builtin: true,
  is_active: true,
  is_deleted: false,
  sort_order: 0,
};

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  // Mirrors the real Plural: pick the branch, substitute # with the value.
  Plural: ({
    value,
    one,
    other,
  }: {
    value: number;
    one: string;
    other: string;
  }) => (value === 1 ? one : other).replace("#", String(value)),
}));
jest.mock("@lingui/core/macro", () => ({
  msg: (s: TemplateStringsArray) => s[0],
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      accent: "#0f0",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const pad = (n: number) => String(n).padStart(2, "0");
const localStamp = (day: number, hour: number) =>
  `2026-09-${pad(day)}T${pad(hour)}:00:00`;

const sessionWithWeight = (
  day: number,
  displayValue: number,
): BodyMeasurementSession => ({
  entry: { id: day, recorded_at: localStamp(day, 8) },
  values: [
    {
      metric: WEIGHT,
      canonicalValue: displayValue,
      displayValue,
      displayUnit: "kg",
    },
  ],
});

const renderCard = (
  props: Partial<React.ComponentProps<typeof MeasurementQuickLogCard>> = {},
) =>
  render(
    <MeasurementQuickLogCard
      metrics={[WEIGHT]}
      sessions={[]}
      onPress={jest.fn()}
      {...props}
    />,
  );

describe("MeasurementQuickLogCard", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 21, 10, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("prompts to start tracking when nothing has ever been logged", () => {
    const { getByText } = renderCard();

    getByText(/track your body measurements/i);
  });

  it("shows the latest body weight with its unit", () => {
    const { getByText } = renderCard({
      sessions: [sessionWithWeight(21, 82.5)],
    });

    getByText("82.5 kg");
  });

  it("says today when the entry was logged today", () => {
    const { getByText } = renderCard({
      sessions: [sessionWithWeight(21, 82.5)],
    });

    getByText(/logged today/i);
  });

  it("counts the days since an older entry", () => {
    const { getByText } = renderCard({ sessions: [sessionWithWeight(18, 83)] });

    getByText(/3 days ago/i);
  });

  it("opens the log sheet when tapped", () => {
    const onPress = jest.fn();

    const { getByTestId } = renderCard({
      sessions: [sessionWithWeight(21, 82.5)],
      onPress,
    });
    fireEvent.press(getByTestId("measurement-quick-log-card"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when the user has disabled every metric", () => {
    const { queryByTestId } = renderCard({ metrics: [] });

    expect(queryByTestId("measurement-quick-log-card")).toBeNull();
  });

  it("renders nothing while the metric list is still loading", () => {
    const { queryByTestId } = renderCard({
      metrics: undefined,
      sessions: undefined,
    });

    expect(queryByTestId("measurement-quick-log-card")).toBeNull();
  });
});
