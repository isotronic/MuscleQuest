import React from "react";
import { render } from "@testing-library/react-native";
import { ConfettiAnimation } from "../ConfettiAnimation";

const mockReducedMotion = jest.fn(() => false);
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => mockReducedMotion(),
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (v: number) => v,
    withDelay: (_d: number, v: number) => v,
  };
});

describe("ConfettiAnimation", () => {
  it("celebrates with particles by default", () => {
    const { toJSON } = render(<ConfettiAnimation />);
    expect(toJSON()).not.toBeNull();
  });

  it("renders nothing when the system asks for reduced motion", () => {
    mockReducedMotion.mockReturnValue(true);
    const { toJSON } = render(<ConfettiAnimation />);
    expect(toJSON()).toBeNull();
  });
});
