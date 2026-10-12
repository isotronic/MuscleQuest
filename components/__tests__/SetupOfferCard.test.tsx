import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { SetupOfferCard } from "../SetupOfferCard";

const mockUpdate = jest.fn();
let mockSetupDone: string | undefined;

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({ colors: {} }),
  radii: { md: 8 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ui", () => ({ AppIcon: () => null }));
jest.mock("@/components/ui/AppIconButton", () => {
  const { Pressable } = require("react-native");
  return {
    AppIconButton: ({ onPress, accessibilityLabel }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      />
    ),
  };
});
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { setupDone: mockSetupDone } }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: mockUpdate }),
}));

describe("SetupOfferCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetupDone = "offered";
  });

  it("opens setup when the card is tapped", () => {
    const { getByText } = render(<SetupOfferCard />);
    fireEvent.press(getByText("Check your units and week start"));
    expect(router.push).toHaveBeenCalledWith("/setup");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("hides itself for good from the dismiss button", () => {
    const { getByLabelText } = render(<SetupOfferCard />);
    fireEvent.press(getByLabelText("Dismiss"));
    expect(mockUpdate).toHaveBeenCalledWith({
      key: "setupDone",
      value: "done",
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("renders nothing once setup is done", () => {
    mockSetupDone = "done";
    const { toJSON } = render(<SetupOfferCard />);
    expect(toJSON()).toBeNull();
  });
});
