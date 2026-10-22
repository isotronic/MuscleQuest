import { renderHook } from "@testing-library/react-native";
import * as NavigationBar from "expo-navigation-bar";
import { useWorkoutImmersiveMode } from "../useWorkoutImmersiveMode";

jest.mock("react-native", () => ({ Platform: { OS: "android" } }));

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: jest.fn().mockResolvedValue(undefined),
}));

// Each mounted screen registers its focus effect here; the test decides when
// a screen gains and loses focus, in the order the navigator would.
const focusEffects: (() => void | (() => void))[] = [];
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffects.push(effect);
  },
}));

const setVisibility = NavigationBar.setVisibilityAsync as jest.Mock;
const lastVisibility = () => setVisibility.mock.calls.at(-1)?.[0];

const mountScreen = () => {
  renderHook(() => useWorkoutImmersiveMode());
  return focusEffects[focusEffects.length - 1];
};

beforeEach(() => {
  jest.useFakeTimers();
  focusEffects.length = 0;
  setVisibility.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useWorkoutImmersiveMode", () => {
  it("hides the navigation bar while a workout screen is focused and shows it after", () => {
    const blur = mountScreen()();
    expect(lastVisibility()).toBe("hidden");

    blur?.();
    jest.runAllTimers();
    expect(lastVisibility()).toBe("visible");
  });

  it("keeps the bar hidden when the next workout screen focuses before the previous one blurs", () => {
    const blurOverview = mountScreen()();
    const focusSession = mountScreen();

    // The navigator runs the new screen's focus before the old screen's blur.
    const blurSession = focusSession();
    blurOverview?.();
    jest.runAllTimers();
    expect(lastVisibility()).toBe("hidden");

    blurSession?.();
    jest.runAllTimers();
    expect(lastVisibility()).toBe("visible");
  });

  it("does not flash the bar when the previous workout screen blurs first", () => {
    const blurOverview = mountScreen()();
    const focusSession = mountScreen();

    blurOverview?.();
    const blurSession = focusSession();
    jest.runAllTimers();
    expect(setVisibility).not.toHaveBeenCalledWith("visible");

    blurSession?.();
    jest.runAllTimers();
    expect(lastVisibility()).toBe("visible");
  });
});
