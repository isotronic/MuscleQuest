import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useTimer } from "react-timer-hook";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { t } from "@lingui/core/macro";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useRestTimerResync } from "@/hooks/useRestTimerResync";
import { usePauseWhenRestEndsEarly } from "@/hooks/usePauseWhenRestEndsEarly";
import { useSoundStore } from "@/store/soundStore";
import { useRestHint } from "@/hooks/useRestHint";
import {
  cancelRestNotifications,
  restEndedInApp,
  scheduleRestNotificationWithCancellation,
} from "@/utils/restNotification";

/**
 * The session's rest countdown for a screen that shows RestTimerOverlay but
 * does not run the focus screen's set flow: the overview and the list
 * logging mode. Plays the end-of-rest cue only while the screen is focused.
 */
export function useRestTimerControls() {
  const { data: settings } = useSettingsQuery();
  const timerRunning = useActiveWorkoutStore((s) => s.timerRunning);
  const timerExpiry = useActiveWorkoutStore((s) => s.timerExpiry);
  const { playSound, triggerVibration } = useSoundStore();

  const parsedIncrement = parseInt(settings?.restTimerIncrement || "15", 10);
  const increment =
    Number.isFinite(parsedIncrement) && parsedIncrement > 0
      ? parsedIncrement
      : 15;
  const buttonSize = settings
    ? settings.buttonSize === "Standard"
      ? 40
      : settings.buttonSize === "Large"
        ? 60
        : 80
    : 40;

  const { hint, hintAction } = useRestHint();

  const isFocusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, []),
  );

  const expiryTimestampRef = useRef<Date | null>(null);
  const timerTranslateY = useSharedValue(timerRunning ? 0 : 200);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timerTranslateY.value }],
  }));

  const { seconds, minutes, restart, pause } = useTimer({
    expiryTimestamp: timerExpiry || new Date(),
    autoStart: timerRunning,
    onExpire: () => {
      const store = useActiveWorkoutStore.getState();
      // The timer fires once its own expiry has passed; a later one in the
      // store means a newer rest started, whose notification must stay.
      const isCurrentRest =
        !store.timerExpiry ||
        new Date(store.timerExpiry).getTime() <= Date.now();
      store.stopTimer();
      // The next set starts now, so its duration can be recorded, whether or
      // not this screen is on top; only the cue needs it to be.
      if (!store.currentSetStartedAt) store.setCurrentSetStartedAt(new Date());
      if (isFocusedRef.current) {
        if (settings?.restTimerSound === "true") void playSound();
        if (settings?.restTimerVibration === "true") triggerVibration();
        if (isCurrentRest) restEndedInApp();
      }
    },
  });

  useRestTimerResync(restart);
  usePauseWhenRestEndsEarly(pause);

  useEffect(() => {
    timerTranslateY.value = withTiming(timerRunning ? 0 : 200, {
      duration: 300,
    });
  }, [timerRunning, timerTranslateY]);

  useEffect(() => {
    if (timerRunning && timerExpiry) {
      const time = new Date(timerExpiry);
      expiryTimestampRef.current = time;
      restart(time);
    }
  }, [timerRunning, timerExpiry, restart]);

  const skip = () => {
    const store = useActiveWorkoutStore.getState();
    store.endRestEarly();
    void cancelRestNotifications();
    // The next set starts now, as it would have when the rest ran out.
    if (!store.currentSetStartedAt) store.setCurrentSetStartedAt(new Date());
  };

  const adjust = async (deltaSeconds: number) => {
    const currentRemaining = expiryTimestampRef.current
      ? Math.max(
          0,
          Math.round(
            (expiryTimestampRef.current.getTime() - Date.now()) / 1000,
          ),
        )
      : minutes * 60 + seconds;
    const newRemaining = Math.max(0, currentRemaining + deltaSeconds);
    const newExpiry = new Date();
    newExpiry.setSeconds(newExpiry.getSeconds() + newRemaining);
    expiryTimestampRef.current = newExpiry;
    useActiveWorkoutStore.getState().startTimer(newExpiry);
    restart(newExpiry);
    await scheduleRestNotificationWithCancellation(
      newRemaining,
      t`Rest Timer Finished!`,
      t`Time to do your next set!`,
    );
  };

  return {
    timerRunning,
    minutes,
    seconds,
    increment,
    buttonSize,
    animStyle,
    adjust,
    skip,
    hint,
    hintAction,
  };
}
