import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import ProfileSettingsScreen from "../settings/profile";

let mockSettings: Record<string, string> = {};
let mockLatest: unknown[] | undefined = [];

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => {
  const raw = (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v);
  return { t: raw, msg: (s: TemplateStringsArray) => ({ message: s[0] }) };
});
jest.mock("@lingui/react", () => {
  const translate = (d: { message: string }) => d.message;
  return { useLingui: () => ({ _: translate, i18n: { _: translate } }) };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("@/components/settings/AccountCard", () => ({
  AccountCard: () => null,
}));
jest.mock("@/components/AccountOwnershipNotice", () => ({
  AccountOwnershipNotice: () => null,
}));
jest.mock("@/components/PrivacySettings", () => ({
  PrivacySettings: () => null,
}));
jest.mock("@/context/AuthProvider", () => {
  const { createContext } = require("react");
  return { AuthContext: createContext(null) };
});
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
jest.mock("@/hooks/useSettingsOverlay", () => ({
  useSettingsOverlay: () => ({ showOverlay: jest.fn(), overlay: null }),
}));
jest.mock("@/hooks/useWeekRule", () => ({
  useWeekRule: () => ({ weekStartsOn: 1, previous: null, from: null }),
}));
jest.mock("@/hooks/useBodyMeasurementSessionsQuery", () => ({
  useLatestBodyMetricValuesQuery: () => ({ data: mockLatest }),
}));

const THIS_YEAR = `${new Date().getFullYear()}-01-03T08:00:00.000Z`;

const weightEntry = (displayValue: number, recorded_at: string) => ({
  metric: { id: 1, key: "weight", value_kind: "mass" },
  canonicalValue: displayValue,
  displayValue,
  displayUnit: "kg",
  recorded_at,
});

describe("Profile settings body weight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = { weightUnit: "kg", weeklyGoal: "3", bodyWeight: "70" };
    mockLatest = [
      {
        metric: { id: 2, key: "waist", value_kind: "length" },
        canonicalValue: 80,
        displayValue: 80,
        displayUnit: "cm",
        recorded_at: "2026-10-05T08:00:00.000Z",
      },
      weightEntry(70, THIS_YEAR),
    ];
  });

  it("shows the latest logged weight and when it was logged", () => {
    const { getByText } = render(<ProfileSettingsScreen />);
    const date = new Date(THIS_YEAR).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    expect(getByText(`70 kg, logged ${date}`)).toBeTruthy();
    expect(
      getByText("Used for assisted and bodyweight exercises"),
    ).toBeTruthy();
  });

  it("shows the year of an entry from an earlier year", () => {
    mockLatest = [weightEntry(70, "2024-10-03T08:00:00.000Z")];
    const { getByText } = render(<ProfileSettingsScreen />);
    const date = new Date("2024-10-03T08:00:00.000Z").toLocaleDateString(
      undefined,
      { day: "numeric", month: "short", year: "numeric" },
    );
    expect(getByText(`70 kg, logged ${date}`)).toBeTruthy();
  });

  it("shows no stale value while the latest entry loads", () => {
    mockLatest = undefined;
    const { queryByText } = render(<ProfileSettingsScreen />);
    expect(queryByText(/70/)).toBeNull();
    expect(queryByText("Add your body weight")).toBeNull();
  });

  it("opens Measurements with the weight field focused", () => {
    const { getByText } = render(<ProfileSettingsScreen />);
    fireEvent.press(getByText("Body weight"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(stats)/measurements",
      params: { focus: "weight" },
    });
  });

  it("asks for a body weight when none was logged", () => {
    mockLatest = [];
    delete mockSettings.bodyWeight;
    const { getByText } = render(<ProfileSettingsScreen />);
    fireEvent.press(getByText("Add your body weight"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(stats)/measurements",
      params: { focus: "weight" },
    });
  });
});
