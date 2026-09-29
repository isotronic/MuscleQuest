import React from "react";
import { render } from "@testing-library/react-native";
import RestTimerOverlay from "../RestTimerOverlay";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: { View } };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#111",
      cardSecondary: "#222",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 16 },
}));

const baseProps = {
  minutes: 1,
  seconds: 5,
  increment: 15,
  timerRunning: true,
  animStyle: {},
  onAdjust: jest.fn(),
};

describe("RestTimerOverlay", () => {
  it("shows the countdown", () => {
    const { getByText } = render(<RestTimerOverlay {...baseProps} />);
    expect(getByText("1:05")).toBeTruthy();
  });

  it("shows a hint below the countdown when given one", () => {
    const { getByText } = render(
      <RestTimerOverlay {...baseProps} hint="Notifications are off" />,
    );
    expect(getByText("Notifications are off")).toBeTruthy();
  });
});
