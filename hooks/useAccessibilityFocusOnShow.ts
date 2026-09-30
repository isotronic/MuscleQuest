import { useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle } from "react-native";

// Modals fade in; focusing before the view is laid out is ignored on Android.
const FOCUS_DELAY_MS = 300;

/**
 * Returns a ref for a modal's title. When `visible` turns true, screen reader
 * focus moves to that element so the user hears where they are instead of
 * landing on whatever control happens to come first.
 */
export function useAccessibilityFocusOnShow<T>(visible: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const node = ref.current
        ? findNodeHandle(ref.current as unknown as React.Component)
        : null;
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return ref;
}
