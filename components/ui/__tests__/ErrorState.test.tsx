import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { ErrorState } from "../ErrorState";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, onPress }: any) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

describe("ErrorState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows a translated message, never the raw error", () => {
    const { getByText } = render(<ErrorState onRetry={jest.fn()} />);

    expect(getByText("Something went wrong loading this.")).toBeTruthy();
  });

  it("uses a screen-specific message when given one", () => {
    const { getByText, queryByText } = render(
      <ErrorState message="Your settings could not be loaded." />,
    );

    expect(getByText("Your settings could not be loaded.")).toBeTruthy();
    expect(queryByText("Something went wrong loading this.")).toBeNull();
  });

  it("Try again calls onRetry", () => {
    const onRetry = jest.fn();
    const { getByText } = render(<ErrorState onRetry={onRetry} />);

    fireEvent.press(getByText("Try again"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("Go home replaces the route with the home tab", () => {
    const { getByText } = render(<ErrorState onRetry={jest.fn()} />);

    fireEvent.press(getByText("Go home"));

    expect(router.replace).toHaveBeenCalledWith("/(app)/(tabs)");
  });

  it("leaves out Try again without onRetry and Go home when asked", () => {
    const { queryByText } = render(<ErrorState showHome={false} />);

    expect(queryByText("Try again")).toBeNull();
    expect(queryByText("Go home")).toBeNull();
  });
});
