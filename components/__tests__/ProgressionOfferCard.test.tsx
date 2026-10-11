import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ProgressionOfferCard from "../ProgressionOfferCard";

const mockUpdateSetting = jest.fn();
let mockSettings: Record<string, string> = {};
let mockEnabled = false;
let mockCount: number | undefined = 3;

jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
jest.mock("@/hooks/useProgressionSettingsQuery", () => ({
  useProgressionSettingsQuery: () => ({ enabled: mockEnabled }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: mockUpdateSetting }),
}));
jest.mock("@/hooks/useSavedWorkoutSessionCountQuery", () => ({
  useSavedWorkoutSessionCountQuery: () => ({ data: mockCount }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("react-native-paper", () => {
  const { Text } = require("react-native");
  return {
    Button: ({ children, onPress }: any) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: { card: "#111", accent: "#0f0", contentPrimary: "#fff" },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const OFFER = "Want MuscleQuest to suggest your next weights?";

beforeEach(() => {
  mockUpdateSetting.mockClear();
  mockSettings = {};
  mockEnabled = false;
  mockCount = 3;
});

describe("ProgressionOfferCard", () => {
  it("is not offered before the third saved-workout session", () => {
    mockCount = 2;
    const { queryByText } = render(<ProgressionOfferCard fromSavedWorkout />);
    expect(queryByText(OFFER)).toBeNull();
  });

  it("Turn on enables progression, records the answer and confirms", () => {
    const { getByText, queryByText } = render(
      <ProgressionOfferCard fromSavedWorkout />,
    );
    fireEvent.press(getByText("Turn on"));

    expect(mockUpdateSetting).toHaveBeenCalledWith({
      key: "adaptive_progression_enabled",
      value: "1",
    });
    expect(mockUpdateSetting).toHaveBeenCalledWith({
      key: "progressionOfferAnswered",
      value: "on",
    });
    expect(queryByText(OFFER)).toBeNull();
    expect(getByText("Open settings")).toBeTruthy();
  });

  it("is not offered again after Turn on", () => {
    mockSettings = { progressionOfferAnswered: "on" };
    const { queryByText } = render(<ProgressionOfferCard fromSavedWorkout />);
    expect(queryByText(OFFER)).toBeNull();
  });

  it("Not now stores today's date and hides the card", () => {
    const { getByText, queryByText } = render(
      <ProgressionOfferCard fromSavedWorkout />,
    );
    fireEvent.press(getByText("Not now"));

    expect(mockUpdateSetting).toHaveBeenCalledWith({
      key: "progressionOfferAnswered",
      value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(queryByText(OFFER)).toBeNull();
  });
});
