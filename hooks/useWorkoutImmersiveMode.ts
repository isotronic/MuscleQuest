import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";

// Moving between two workout screens, the navigator runs the old screen's blur
// and the new one's focus in either order (the new focus first since SDK 55).
// The bar comes back only when no workout screen is focused, and only after a
// short wait, so a blur followed by a focus does not flash it.
const SHOW_DELAY_MS = 300;
let focusedScreens = 0;
let pendingShow: ReturnType<typeof setTimeout> | null = null;

export function useWorkoutImmersiveMode() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      focusedScreens += 1;
      if (pendingShow) {
        clearTimeout(pendingShow);
        pendingShow = null;
      }
      void NavigationBar.setVisibilityAsync("hidden");

      return () => {
        focusedScreens -= 1;
        if (focusedScreens > 0) return;
        pendingShow = setTimeout(() => {
          pendingShow = null;
          if (focusedScreens === 0) {
            void NavigationBar.setVisibilityAsync("visible");
          }
        }, SHOW_DELAY_MS);
      };
    }, []),
  );
}
