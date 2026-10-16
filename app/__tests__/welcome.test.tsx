import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import WelcomeScreen from "../welcome";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: { background: "#000", contentPrimary: "#fff", contentSecondary: "#aaa" },
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
jest.mock("@/components/ui", () => ({ AppImage: () => null }));
jest.mock("@/assets/images/icon.png", () => 1);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
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

describe("WelcomeScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts setup", async () => {
    const { getByText } = render(<WelcomeScreen />);
    await act(async () => fireEvent.press(getByText("Get started")));
    expect(router.push).toHaveBeenCalledWith("/setup");
  });

  it("sends a returning user to sign in first", async () => {
    const { getByText } = render(<WelcomeScreen />);
    await act(async () =>
      fireEvent.press(getByText("I've used MuscleQuest before")),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/login",
      params: { onboarding: "returning" },
    });
  });
});
