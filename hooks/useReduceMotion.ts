import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system "reduce motion" setting, kept current while the app runs.
 * Reanimated's useReducedMotion reads it once at module load, so a change made
 * in system settings would not apply until the next launch.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
