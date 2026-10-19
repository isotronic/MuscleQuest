import { useEffect } from "react";
import { AppState } from "react-native";
import { t } from "@lingui/core/macro";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useRestHintStore } from "@/store/restHintStore";
import {
  exactAlarmsAllowed,
  scheduleRestNotificationWithCancellation,
} from "@/utils/restNotification";
import { openExactAlarmSettings } from "@/modules/exact-alarm";

/**
 * The hint and its button for RestTimerOverlay, on every workout screen
 * that shows the rest countdown.
 */
export function useRestHint(): {
  hint?: string;
  hintAction?: { label: string; onPress: () => void };
} {
  const timerRunning = useActiveWorkoutStore((s) => s.timerRunning);
  const showPermissionHint = useRestHintStore((s) => s.showPermissionHint);
  const showExactAlarmHint = useRestHintStore((s) => s.showExactAlarmHint);

  useEffect(() => {
    if (!timerRunning) useRestHintStore.getState().clearRestHints();
  }, [timerRunning]);

  // Back from the "Alarms & reminders" screen: the running rest's alert was
  // scheduled inexact, so schedule it again as exact, then drop the hint.
  useEffect(() => {
    if (!showExactAlarmHint) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !exactAlarmsAllowed()) return;
      const hints = useRestHintStore.getState();
      // Another screen with the overlay may have handled it already.
      if (!hints.showExactAlarmHint) return;
      hints.hideExactAlarmHint();
      const expiry = useActiveWorkoutStore.getState().timerExpiry;
      const remaining = expiry
        ? Math.round((new Date(expiry).getTime() - Date.now()) / 1000)
        : 0;
      if (remaining > 0) {
        void scheduleRestNotificationWithCancellation(
          remaining,
          t`Rest Timer Finished!`,
          t`Time to do your next set!`,
        );
      }
    });
    return () => subscription.remove();
  }, [showExactAlarmHint]);

  if (showPermissionHint) {
    return {
      hint: t`Notifications are off, so there is no rest alert while your phone is locked. You can turn them on in your phone's settings.`,
    };
  }
  if (showExactAlarmHint) {
    return {
      hint: t`Rest alerts may arrive late. Allow alarms for exact timing.`,
      hintAction: { label: t`Allow alarms`, onPress: openExactAlarmSettings },
    };
  }
  return {};
}
