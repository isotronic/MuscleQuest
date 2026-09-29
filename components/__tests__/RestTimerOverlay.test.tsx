import React from "react";
import { AccessibilityInfo } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import RestTimerOverlay from "../RestTimerOverlay";

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: { View } };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
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

describe("RestTimerOverlay accessibility", () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
  });
  afterEach(() => announce.mockRestore());

  it("labels the adjust buttons with the step", () => {
    const onAdjust = jest.fn();
    const { getByRole } = render(
      <RestTimerOverlay {...baseProps} onAdjust={onAdjust} />,
    );
    fireEvent.press(getByRole("button", { name: "Add 15 seconds" }));
    expect(onAdjust).toHaveBeenCalledWith(15);
    fireEvent.press(getByRole("button", { name: "Remove 15 seconds" }));
    expect(onAdjust).toHaveBeenCalledWith(-15);
  });

  it("reads the countdown as one element", () => {
    const { getByLabelText } = render(<RestTimerOverlay {...baseProps} />);
    expect(getByLabelText("Rest time left, 1:05")).toBeTruthy();
  });

  it("is hidden from screen readers while no rest is running", () => {
    const { queryByText } = render(
      <RestTimerOverlay {...baseProps} timerRunning={false} />,
    );
    // Default queries skip elements hidden from assistive technology.
    expect(queryByText("Rest Time Left:")).toBeNull();
    expect(
      queryByText("Rest Time Left:", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("announces the countdown thresholds while running", () => {
    const { rerender } = render(
      <RestTimerOverlay {...baseProps} minutes={0} seconds={31} />,
    );
    expect(announce).not.toHaveBeenCalled();
    rerender(<RestTimerOverlay {...baseProps} minutes={0} seconds={30} />);
    expect(announce).toHaveBeenCalledWith("30 seconds of rest left");
    rerender(<RestTimerOverlay {...baseProps} minutes={0} seconds={29} />);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the countdown moves while not running", () => {
    const { rerender } = render(
      <RestTimerOverlay
        {...baseProps}
        timerRunning={false}
        minutes={0}
        seconds={31}
      />,
    );
    rerender(
      <RestTimerOverlay
        {...baseProps}
        timerRunning={false}
        minutes={0}
        seconds={30}
      />,
    );
    expect(announce).not.toHaveBeenCalled();
  });

  it("announces the end when the timer stops as it reaches zero", () => {
    const { rerender } = render(
      <RestTimerOverlay {...baseProps} minutes={0} seconds={1} />,
    );
    rerender(
      <RestTimerOverlay
        {...baseProps}
        timerRunning={false}
        minutes={0}
        seconds={0}
      />,
    );
    expect(announce).toHaveBeenCalledWith("Rest over");
  });

  it("stays quiet when rest is cut short", () => {
    const { rerender } = render(
      <RestTimerOverlay {...baseProps} minutes={0} seconds={40} />,
    );
    rerender(
      <RestTimerOverlay
        {...baseProps}
        timerRunning={false}
        minutes={0}
        seconds={40}
      />,
    );
    expect(announce).not.toHaveBeenCalled();
  });
});
