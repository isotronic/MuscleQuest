import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ActivePlanAction } from "../ActivePlanAction";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: { contentPrimary: "#000", success: "#0f0" },
  }),
  radii: { full: 9999 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children }: any) => <Text>{children}</Text>,
  };
});
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("react-native-paper", () => {
  const { Text, Pressable } = require("react-native");
  return {
    Button: ({ children, onPress, disabled }: any) => (
      <Pressable
        accessibilityRole="button"
        onPress={disabled ? undefined : onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

describe("ActivePlanAction", () => {
  it("offers to set an inactive plan as active", () => {
    const onActivate = jest.fn();
    const { getByText, queryByText } = render(
      <ActivePlanAction isActive={false} onActivate={onActivate} />,
    );

    fireEvent.press(getByText("Set as active plan"));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(queryByText("Active plan")).toBeNull();
  });

  it("shows a non-interactive chip for the active plan", () => {
    const { getByText, queryByText, queryByRole } = render(
      <ActivePlanAction isActive onActivate={jest.fn()} />,
    );

    expect(getByText("Active plan")).toBeTruthy();
    expect(queryByText("Set as active plan")).toBeNull();
    expect(queryByRole("button")).toBeNull();
  });
});
