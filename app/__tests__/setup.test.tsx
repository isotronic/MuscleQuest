import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import SetupScreen from "../setup";

const mockSave = jest.fn();
let mockSettings: Record<string, string>;

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: { contentPrimary: "#fff", contentSecondary: "#aaa" },
  }),
  radii: { md: 8 },
}));
jest.mock("@/components/ThemedView", () => {
  const { View } = require("react-native");
  return { ThemedView: (props: any) => <View {...props} /> };
});
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    ActivityIndicator: () => null,
    Button: ({ onPress, children }: any) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    // One pressable per option, named by its label.
    SegmentedButtons: ({ buttons, onValueChange }: any) => (
      <View>
        {buttons.map((b: any) => (
          <Pressable
            key={b.value}
            onPress={() => !b.disabled && onValueChange(b.value)}
          >
            <Text>{b.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: mockSettings }),
}));
jest.mock("@/hooks/useSaveSetupMutation", () => ({
  useSaveSetupMutation: () => ({ mutateAsync: mockSave, isPending: false }),
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));
jest.mock("@/utils/startWorkout", () => ({ confirmStartWorkout: jest.fn() }));

const press = async (getByText: (s: string) => any, text: string) => {
  await act(async () => {
    fireEvent.press(getByText(text));
  });
};

describe("SetupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
  });

  it("walks a new install through the steps and saves its choices", async () => {
    // A US device's defaults, before login.
    mockSettings = {
      weightUnit: "lbs",
      weightIncrement: "5",
      weeklyGoal: "3",
      weekStartsOn: "0",
      setupDone: "pending",
    };
    const { getByText, getByLabelText } = render(<SetupScreen />);

    expect(getByText("Set up MuscleQuest")).toBeTruthy();
    await press(getByText, "kg, m, cm");
    // The default pound step follows the switch to kilograms.
    expect(getByText("2.5 kg")).toBeTruthy();
    await press(getByText, "Next");

    await press(getByText, "4");
    await press(getByText, "Monday");
    await press(getByText, "Next");

    // Skipping body weight leaves it unset.
    expect(getByText("Skip")).toBeTruthy();
    fireEvent.changeText(getByLabelText("Body weight in kg"), "80");
    await press(getByText, "Finish");

    expect(mockSave).toHaveBeenCalledWith({
      settings: [
        { key: "weightUnit", value: "kg" },
        { key: "distanceUnit", value: "m" },
        { key: "sizeUnit", value: "cm" },
        { key: "weightIncrement", value: "2.5" },
        { key: "weeklyGoal", value: "4" },
      ],
      weekStartsOn: 1,
      // A new install has no weeks to keep; no transition week.
      weekStartImmediately: true,
      bodyWeightKg: 80,
    });
    expect(getByText("Pick a plan")).toBeTruthy();
    await press(getByText, "Pick a plan");
    expect(router.replace).toHaveBeenCalledWith("/(app)/(tabs)/(plans)");
  });

  it("changes nothing for an older install that saves without edits", async () => {
    mockSettings = {
      weightUnit: "kg",
      distanceUnit: "ft",
      weightIncrement: "1",
      weeklyGoal: "7",
      bodyWeight: "82",
      setupDone: "offered",
    };
    const { getByText } = render(<SetupScreen />);

    expect(getByText("Check your setup")).toBeTruthy();
    // The stored goal is offered and selected.
    await press(getByText, "Next");
    expect(getByText("7")).toBeTruthy();
    expect(screen.getByRole("radio", { checked: true })).toHaveTextContent("7");
    await press(getByText, "Next");
    await press(getByText, "Save");

    expect(mockSave).toHaveBeenCalledWith({ settings: [] });
    expect(router.back).toHaveBeenCalled();
  });

  it("restores the weight step when the units are switched back", async () => {
    mockSettings = {
      weightUnit: "kg",
      weightIncrement: "1",
      weeklyGoal: "3",
      setupDone: "offered",
    };
    const { getByText } = render(<SetupScreen />);

    await press(getByText, "lbs, ft, in");
    await press(getByText, "kg, m, cm");
    await press(getByText, "Next");
    await press(getByText, "Next");
    await press(getByText, "Save");

    expect(mockSave).toHaveBeenCalledWith({ settings: [] });
  });
});
