import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";

export function useWorkoutImmersiveMode() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      void NavigationBar.setVisibilityAsync("hidden");

      return () => {
        void NavigationBar.setVisibilityAsync("visible");
      };
    }, []),
  );
}
