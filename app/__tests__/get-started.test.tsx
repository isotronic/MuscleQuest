import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import GetStartedScreen from "../get-started";
import { confirmStartWorkout } from "@/utils/startWorkout";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#000",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
    },
  }),
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
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@/utils/startWorkout", () => ({ confirmStartWorkout: jest.fn() }));
jest.mock("@/store/activeWorkoutStore", () => ({
  useActiveWorkoutStore: { getState: () => ({ startQuickWorkout: jest.fn() }) },
}));
jest.mock("@/components/StarterPlanList", () => {
  const { Pressable, Text } = require("react-native");
  return {
    StarterPlanList: ({ onSelect }: any) => (
      <Pressable onPress={() => onSelect(42)}>
        <Text>Full body plan</Text>
      </Pressable>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ onPress, children }: any) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

const press = async (getByText: (s: string) => any, text: string) => {
  await act(async () => fireEvent.press(getByText(text)));
};

describe("GetStartedScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens a starter plan", async () => {
    const { getByText } = render(<GetStartedScreen />);
    await press(getByText, "Full body plan");
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/(plans)/overview",
      params: { planId: "42" },
    });
  });

  it("starts a quick workout from home", async () => {
    const { getByText } = render(<GetStartedScreen />);
    await press(getByText, "Start a quick workout");
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(confirmStartWorkout).toHaveBeenCalled();
  });

  it("goes home without choosing", async () => {
    const { getByText } = render(<GetStartedScreen />);
    await press(getByText, "Skip, go to home");
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(confirmStartWorkout).not.toHaveBeenCalled();
  });
});
