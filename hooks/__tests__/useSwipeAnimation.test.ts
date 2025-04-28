import { renderHook, act } from "@testing-library/react-native";
import { useSwipeAnimation } from "../useSwipeAnimation";
import {
  State,
  PanGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import { GestureEvent } from "react-native-gesture-handler/lib/typescript/handlers/gestureHandlerCommon";

describe("useSwipeAnimation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Helper function to create a mock gesture event
  const createMockGestureEvent = (
    translationX: number,
  ): GestureEvent<PanGestureHandlerEventPayload> => {
    return {
      nativeEvent: {
        translationX,
        state: State.END,
        handlerTag: 1,
        numberOfPointers: 1,
        x: 0,
        y: 0,
        absoluteX: 0,
        absoluteY: 0,
        velocityX: 0,
        velocityY: 0,
      },
    } as GestureEvent<PanGestureHandlerEventPayload>;
  };

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useSwipeAnimation());

    expect(result.current.isAnimating).toBe(false);
    expect(result.current.translateX).toBeDefined();
    expect(typeof result.current.handleSwipeGesture).toBe("function");
    expect(typeof result.current.animateSets).toBe("function");
    expect(typeof result.current.resetSwipe).toBe("function");
    expect(typeof result.current.screenWidth).toBe("number");
  });

  it("should handle swipe gesture with onSwipeLeft callback", () => {
    const onSwipeLeft = jest.fn();
    const { result } = renderHook(() => useSwipeAnimation({ onSwipeLeft }));

    // Mock a swipe left gesture
    act(() => {
      result.current.handleSwipeGesture(createMockGestureEvent(-100));
    });

    // The animation should start
    expect(result.current.isAnimating).toBe(true);

    // Complete the animation
    jest.runAllTimers();

    // The callback should have been called
    expect(onSwipeLeft).toHaveBeenCalled();
  });

  it("should handle swipe gesture with onSwipeRight callback", () => {
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() => useSwipeAnimation({ onSwipeRight }));

    // Mock a swipe right gesture
    act(() => {
      result.current.handleSwipeGesture(createMockGestureEvent(100));
    });

    // The animation should start
    expect(result.current.isAnimating).toBe(true);

    // Complete the animation
    jest.runAllTimers();

    // The callback should have been called
    expect(onSwipeRight).toHaveBeenCalled();
  });

  it("should not trigger swipe if below threshold", () => {
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() =>
      useSwipeAnimation({ onSwipeLeft, onSwipeRight, swipeThreshold: 80 }),
    );

    // Mock a small swipe that doesn't exceed the threshold
    act(() => {
      result.current.handleSwipeGesture(createMockGestureEvent(60));
    });

    // The callbacks should not have been called
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("should animate sets with callback", () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useSwipeAnimation());

    act(() => {
      result.current.animateSets(100, callback);
    });

    // The animation should start
    expect(result.current.isAnimating).toBe(true);

    // Complete the animation
    jest.runAllTimers();

    // The callback should have been called
    expect(callback).toHaveBeenCalled();
  });
});
