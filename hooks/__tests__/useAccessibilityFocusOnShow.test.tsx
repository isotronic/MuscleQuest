import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { act, render } from "@testing-library/react-native";
import { useAccessibilityFocusOnShow } from "../useAccessibilityFocusOnShow";

function Title({ visible }: { visible: boolean }) {
  const ref = useAccessibilityFocusOnShow<Text>(visible);
  return visible ? <Text ref={ref}>Plate Calculator</Text> : null;
}

describe("useAccessibilityFocusOnShow", () => {
  let focus: jest.SpyInstance;
  let nodeHandle: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    // The test renderer has no native views, so hand back a stand-in tag.
    nodeHandle = jest
      .spyOn(require("react-native"), "findNodeHandle")
      .mockReturnValue(42);
    focus = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => {});
  });
  afterEach(() => {
    focus.mockRestore();
    nodeHandle.mockRestore();
    jest.useRealTimers();
  });

  it("moves focus to the element once it is shown", () => {
    const { rerender } = render(<Title visible={false} />);
    act(() => jest.runAllTimers());
    expect(focus).not.toHaveBeenCalled();

    rerender(<Title visible />);
    act(() => jest.runAllTimers());
    expect(focus).toHaveBeenCalledWith(42);
  });

  it("does not refocus on re-renders while shown", () => {
    const { rerender } = render(<Title visible />);
    act(() => jest.runAllTimers());
    rerender(<Title visible />);
    act(() => jest.runAllTimers());
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
