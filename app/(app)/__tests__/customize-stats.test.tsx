import React from "react";
import { Alert } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import CustomizeStatsScreen from "../(tabs)/(stats)/customize";
import CustomizeWidgetScreen from "../(tabs)/(stats)/customize-widget";
import {
  defaultStatsLayout,
  setWidgetConfig,
  widgetConfig,
  type StatsLayout,
} from "@/utils/statsLayout";

const mockSave = jest.fn();
let mockLayout: StatsLayout;
let mockParams: { id?: string } = {};
const mockPush = jest.fn();

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => {
  const raw = (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v);
  return {
    t: raw,
    msg: (s: TemplateStringsArray, ...v: unknown[]) => ({ id: raw(s, ...v) }),
    plural: (n: number, forms: { one: string; other: string }) =>
      (n === 1 ? forms.one : forms.other).replace("#", String(n)),
  };
});
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (d: { id: string }) => d.id }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  Stack: { Screen: () => null },
}));
jest.mock("react-native-sortables", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      // Rendered as a plain list; dragging is the library's job.
      Grid: ({ data, renderItem, keyExtractor }: any) => (
        <View>
          {data.map((item: any, index: number) => (
            <View key={keyExtractor(item)}>{renderItem({ item, index })}</View>
          ))}
        </View>
      ),
      Handle: ({ children }: any) => children,
      Touchable: ({ children }: any) => children,
    },
  };
});
jest.mock("react-native-gifted-charts", () => ({
  BarChart: () => null,
  LineChart: () => null,
  PieChart: () => null,
}));
jest.mock("@/hooks/useStatsLayout", () => ({
  useStatsLayout: () => ({ layout: mockLayout, isLoading: false }),
  useUpdateStatsLayoutMutation: () => ({ save: mockSave }),
}));
jest.mock("@/hooks/useBodyMetricDefinitionsQuery", () => ({
  useActiveBodyMetricDefinitionsQuery: () => ({
    data: [
      { id: 1, key: "weight", label: "Weight" },
      { id: 2, key: "waist", label: "Waist" },
    ],
  }),
}));
jest.mock("@/components/ui", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    AppIcon: () => null,
    checkboxLabel: (label: string) => ({ accessibilityLabel: label }),
    checkboxCaptionA11y: {},
    // A select is a row of buttons, one per option.
    AppSelect: ({ data, onChange, accessibilityLabel }: any) => (
      <View accessibilityLabel={accessibilityLabel}>
        {data.map((o: any) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabel}: ${o.label}`}
            onPress={() => onChange(o.value)}
          >
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

const lastSaved = (): StatsLayout => mockSave.mock.calls.at(-1)[0];

beforeEach(() => {
  mockSave.mockClear();
  mockPush.mockClear();
  mockLayout = defaultStatsLayout();
  mockParams = {};
});

describe("CustomizeStatsScreen", () => {
  it("lists every section and hides one", () => {
    const { getByLabelText } = render(<CustomizeStatsScreen />);
    fireEvent(getByLabelText("Show Consistency"), "valueChange", false);
    expect(lastSaved().widgets.find((w) => w.id === "heatmap")!.visible).toBe(
      false,
    );
  });

  it("moves a section with the screen reader actions", () => {
    const { getByLabelText } = render(<CustomizeStatsScreen />);
    fireEvent(getByLabelText("Reorder Summary"), "accessibilityAction", {
      nativeEvent: { actionName: "moveUp" },
    });
    expect(
      lastSaved()
        .widgets.slice(0, 2)
        .map((w) => w.id),
    ).toEqual(["summary", "insights"]);
  });

  it("does not move the first section further up", () => {
    const { getByLabelText } = render(<CustomizeStatsScreen />);
    fireEvent(getByLabelText("Reorder Insights"), "accessibilityAction", {
      nativeEvent: { actionName: "moveUp" },
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("opens a section's settings", () => {
    const { getByLabelText } = render(<CustomizeStatsScreen />);
    fireEvent.press(getByLabelText("Recent PRs settings"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "recentPRs" } }),
    );
  });

  it("resets to the default layout after confirming", () => {
    mockLayout = {
      v: 1,
      widgets: defaultStatsLayout().widgets.map((w) => ({
        ...w,
        visible: false,
      })),
    };
    const alert = jest.spyOn(Alert, "alert");
    const { getByText } = render(<CustomizeStatsScreen />);
    fireEvent.press(getByText("Reset to default"));
    const buttons = alert.mock.calls.at(-1)![2]!;
    buttons.find((b) => b.text === "Reset")!.onPress!();
    expect(lastSaved()).toEqual(defaultStatsLayout());
  });
});

describe("CustomizeWidgetScreen", () => {
  it("changes a trend chart's metric and pins its range", () => {
    mockParams = { id: "trendB" };
    const { getByLabelText } = render(<CustomizeWidgetScreen />);
    fireEvent.press(getByLabelText("Show: Reps"));
    expect(widgetConfig(lastSaved(), "trendB").metric).toBe("reps");
    fireEvent.press(getByLabelText("Time range: Last year"));
    expect(widgetConfig(lastSaved(), "trendB").range).toBe("365");
  });

  it("keeps at least one summary tile", () => {
    mockLayout = setWidgetConfig(defaultStatsLayout(), "summary", {
      tiles: ["sets"],
    });
    mockParams = { id: "summary" };
    const { getByLabelText } = render(<CustomizeWidgetScreen />);
    fireEvent.press(getByLabelText("Sets"));
    expect(mockSave).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText("Reps"));
    expect(widgetConfig(lastSaved(), "summary").tiles).toEqual([
      "sets",
      "reps",
    ]);
  });

  it("offers only target values that keep the band's minimum below its maximum", () => {
    mockParams = { id: "muscleSets" };
    const { queryByLabelText } = render(<CustomizeWidgetScreen />);
    // Default band is 10 to 20.
    expect(queryByLabelText("Target minimum: 18")).toBeTruthy();
    expect(queryByLabelText("Target minimum: 20")).toBeNull();
    expect(queryByLabelText("Target maximum: 10")).toBeNull();
    expect(queryByLabelText("Target maximum: 12")).toBeTruthy();
  });

  it("shows options only while they apply", () => {
    mockLayout = setWidgetConfig(defaultStatsLayout(), "muscleSets", {
      groupBy: "bodyPart",
      showTarget: false,
    });
    mockParams = { id: "muscleSets" };
    const { queryByLabelText } = render(<CustomizeWidgetScreen />);
    expect(queryByLabelText("Count secondary muscles")).toBeNull();
    expect(queryByLabelText("Target minimum")).toBeNull();
    expect(queryByLabelText("Show target range")).toBeTruthy();
  });

  it("lets the measurements section show any of the user's metrics", () => {
    mockParams = { id: "measurements" };
    const { getByLabelText } = render(<CustomizeWidgetScreen />);
    fireEvent.press(getByLabelText("Waist"));
    expect(widgetConfig(lastSaved(), "measurements").metricKeys).toEqual([
      "waist",
    ]);
  });

  it("explains when the section is unknown", () => {
    mockParams = { id: "bodyMap" };
    const { getByText } = render(<CustomizeWidgetScreen />);
    expect(getByText("This section no longer exists.")).toBeTruthy();
  });
});
