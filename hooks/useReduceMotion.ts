import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * The system "reduce motion" setting, kept current while the app runs.
 * Reanimated's useReducedMotion reads it once at module load, so a change made
 * in system settings would not apply until the next launch. That launch value
 * still seeds the state: it is synchronous, so the first render is already
 * right, and animations that only run on mount are neither lost nor shown.
 */
export function useReduceMotion(): boolean {
  const launchValue = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(launchValue);

  useEffect(() => {
    let active = true;
    // Listen first so no change is missed; a change event is newer than the
    // initial query, so once one arrives the query result is ignored.
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        changed = true;
        setReduceMotion(enabled);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !changed) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
