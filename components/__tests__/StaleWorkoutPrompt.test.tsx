import React from "react";
import { act, render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import { StaleWorkoutPrompt } from "../StaleWorkoutPrompt";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";
import { cancelRestNotifications } from "@/utils/restNotification";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core", () => ({ i18n: { locale: "en" } }));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
      error: "#f00",
      modalBackdrop: "#0008",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) =>
      visible ? <View>{children}</View> : null,
    Button: ({ onPress, children, testID }: any) => (
      <Pressable testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("@/utils/restNotification", () => ({
  cancelRestNotifications: jest.fn().mockResolvedValue(undefined),
}));

const HOUR = 60 * 60 * 1000;

const seedWorkout = (completedSets = {}) =>
  useActiveWorkoutStore.setState({
    activeWorkout: { planId: 1, workoutId: 2, name: "Push Day" },
    workout: { id: 2, name: "Push Day", exercises: [] },
    startTime: new Date(Date.now() - 50 * HOUR),
    lastActivityAt: new Date(Date.now() - 49 * HOUR),
    completedSets,
  });

describe("StaleWorkoutPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedWorkout({ 0: { 0: true } });
    useStaleWorkoutPromptStore.setState({ visible: true });
  });

  it("renders nothing until asked", () => {
    useStaleWorkoutPromptStore.setState({ visible: false });
    const { queryByText } = render(<StaleWorkoutPrompt />);

    expect(queryByText("Pick up where you left off?")).toBeNull();
  });

  it("names the workout and how long ago it was started and last touched", () => {
    const { getByText } = render(<StaleWorkoutPrompt />);

    expect(getByText("Pick up where you left off?")).toBeTruthy();
    expect(
      getByText(
        "You started Push Day 2 days ago. Your last set was 2 days ago.",
      ),
    ).toBeTruthy();
  });

  it("leaves out the last set for a workout persisted before it was tracked", () => {
    useActiveWorkoutStore.setState({ lastActivityAt: null });
    const { getByText } = render(<StaleWorkoutPrompt />);

    expect(getByText("You started Push Day 2 days ago.")).toBeTruthy();
  });

  it("Resume opens the workout and closes the prompt", () => {
    const { getByTestId } = render(<StaleWorkoutPrompt />);

    fireEvent.press(getByTestId("stale-resume"));

    expect(router.push).toHaveBeenCalledWith("/(app)/(workout)");
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(false);
  });

  it("Finish and save opens the workout in finish mode", () => {
    const { getByTestId } = render(<StaleWorkoutPrompt />);

    fireEvent.press(getByTestId("stale-finish"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/(workout)",
      params: { finish: "true" },
    });
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(false);
  });

  it("does not offer Finish and save when no set was completed", () => {
    seedWorkout({});
    const { queryByTestId } = render(<StaleWorkoutPrompt />);

    expect(queryByTestId("stale-finish")).toBeNull();
  });

  it("Discard asks for confirmation before clearing the workout", () => {
    const { getByTestId } = render(<StaleWorkoutPrompt />);

    fireEvent.press(getByTestId("stale-discard"));

    expect(useActiveWorkoutStore.getState().workout).not.toBeNull();
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    act(() => buttons.find((b: any) => b.style === "destructive").onPress());

    expect(useActiveWorkoutStore.getState().workout).toBeNull();
    expect(cancelRestNotifications).toHaveBeenCalled();
    expect(useStaleWorkoutPromptStore.getState().visible).toBe(false);
  });
});
