import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

/**
 * JS timers are throttled in the background, so the countdown can be stale
 * when the user comes back. Recompute it from the stored expiry on every
 * foreground and focus; a timer that ran out meanwhile is stopped (the
 * scheduled notification was the cue) and the next set's timing starts,
 * unless a start is already set.
 */
export function useRestTimerResync(restart: (expiry: Date) => void) {
  const resync = useCallback(() => {
    const {
      timerRunning,
      timerExpiry,
      stopTimer,
      currentSetStartedAt,
      setCurrentSetStartedAt,
    } = useActiveWorkoutStore.getState();
    if (!timerRunning || !timerExpiry) return;
    const expiry = new Date(timerExpiry);
    if (expiry.getTime() <= Date.now()) {
      stopTimer();
      if (!currentSetStartedAt) setCurrentSetStartedAt(new Date());
    } else {
      restart(expiry);
    }
  }, [restart]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resync();
    });
    return () => subscription.remove();
  }, [resync]);

  useFocusEffect(resync);
}
