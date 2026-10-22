import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";

// Workout screens focused right now. Moving between two of them, the navigator
// may run the new screen's focus before the old one's blur (it does since SDK
// 55), so the bar comes back only when the last of them loses focus.
let focusedScreens = 0;

export function useWorkoutImmersiveMode() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      focusedScreens += 1;
      void NavigationBar.setVisibilityAsync("hidden");

      return () => {
        focusedScreens -= 1;
        if (focusedScreens === 0) {
          void NavigationBar.setVisibilityAsync("visible");
        }
      };
    }, []),
  );
}
