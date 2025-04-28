import { useRef, useState } from "react";
import { Animated, Dimensions, Easing } from "react-native";
import {
  PanGestureHandlerGestureEvent,
  State,
} from "react-native-gesture-handler";

type SwipeAnimationOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
};

type SwipeAnimationResult = {
  translateX: any; // Using any for Animated.Value due to type issues
  isAnimating: boolean;
  handleSwipeGesture: (event: PanGestureHandlerGestureEvent) => void;
  animateSets: (direction: number, callback: () => void) => void;
  resetSwipe: () => void;
  screenWidth: number;
};

/**
 * A hook that provides swipe animation functionality for navigating between sets
 * in a workout session.
 *
 * @param options Configuration options for the swipe animation
 * @returns An object containing the animation state and functions
 */
export const useSwipeAnimation = (
  options: SwipeAnimationOptions = {},
): SwipeAnimationResult => {
  const { onSwipeLeft, onSwipeRight, swipeThreshold = 50 } = options;

  const screenWidth = Dimensions.get("window").width;
  const translateX = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  /**
   * Handles the swipe gesture event from PanGestureHandler
   */
  const handleSwipeGesture = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, state } = event.nativeEvent;

    if (state === State.ACTIVE && !isAnimating) {
      translateX.setValue(translationX);
    }

    if (state === State.END && !isAnimating) {
      if (translationX > swipeThreshold) {
        // Swiping right
        if (onSwipeRight) {
          animateSets(screenWidth, onSwipeRight);
        } else {
          resetSwipe();
        }
      } else if (translationX < -swipeThreshold) {
        // Swiping left
        if (onSwipeLeft) {
          animateSets(-screenWidth, onSwipeLeft);
        } else {
          resetSwipe();
        }
      } else {
        resetSwipe();
      }
    }
  };

  /**
   * Animates the swipe transition between sets
   *
   * @param direction The direction to animate (positive for right, negative for left)
   * @param callback Function to call after animation completes
   */
  const animateSets = (direction: number, callback: () => void) => {
    setIsAnimating(true);

    Animated.timing(translateX, {
      toValue: direction,
      duration: 250,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setIsAnimating(false);
      translateX.setValue(0);
      callback();
    });
  };

  /**
   * Resets the swipe animation to the initial position
   */
  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return {
    translateX,
    isAnimating,
    handleSwipeGesture,
    animateSets,
    resetSwipe,
    screenWidth,
  };
};
