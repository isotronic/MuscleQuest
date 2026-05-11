import { useCallback, useEffect, useRef } from "react";

/**
 * Provides onPress / onPressIn / onPressOut handlers that fire `action` once on
 * a short tap and continuously (after `delay` ms, then every `interval` ms) on a
 * long-press. A tap that follows a long-press is suppressed so the action is not
 * fired an extra time when the user lifts their finger.
 */
export function useContinuousPress(
  action: () => void,
  delay = 400,
  interval = 150,
) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartedRef = useRef(false);

  const stop = useCallback(() => {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (pressIntervalRef.current !== null) {
      clearInterval(pressIntervalRef.current);
      pressIntervalRef.current = null;
    }
  }, []);

  const onPressIn = useCallback(() => {
    holdStartedRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      holdStartedRef.current = true;
      action();
      pressIntervalRef.current = setInterval(action, interval);
    }, delay);
  }, [action, delay, interval]);

  const onPressOut = useCallback(() => {
    stop();
  }, [stop]);

  const onPress = useCallback(() => {
    if (holdStartedRef.current) {
      holdStartedRef.current = false;
      return; // suppress the tap that fires after a long-press
    }
    action();
  }, [action]);

  // Clean up timers when the component unmounts
  useEffect(() => stop, [stop]);

  return { onPress, onPressIn, onPressOut };
}
