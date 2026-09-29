import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Bugsnag from "@bugsnag/expo";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";

const REST_TIMER_NOTIFICATION_ID_KEY = "restTimerNotificationId";
const PERMISSION_HINT_SHOWN_KEY = "restNotificationPermissionHintShown";

/** `content.data.kind` of rest timer notifications. */
export const REST_NOTIFICATION_KIND = "rest-timer";

export async function scheduleRestNotification(
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string = "rest-timer1",
) {
  if (secondsFromNow <= 0) {
    return;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: REST_NOTIFICATION_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
        ...(Platform.OS === "android" && { channelId }),
      },
    });
    await setAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY, id);
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to schedule notification:", error);
  }
}

export async function cancelRestNotifications() {
  try {
    const id = await getAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await removeAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY);
      await Notifications.dismissNotificationAsync(id);
    }
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to cancel notifications:", error);
  }
}

/**
 * Cancels any existing rest notifications and schedules a new one.
 * This wrapper ensures the cancel-then-schedule contract is always enforced.
 * @param secondsFromNow how many seconds in the future the notification should fire
 * @param title notification title
 * @param body notification body
 * @param channelId must match the channel you created (on Android)
 */
export async function scheduleRestNotificationWithCancellation(
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string = "rest-timer1",
) {
  await cancelRestNotifications();

  if (secondsFromNow > 0) {
    await scheduleRestNotification(secondsFromNow, title, body, channelId);
  }
}

// Rest notifications are always scheduled, so a backgrounded or locked phone
// still gets its cue. The "restTimerNotification" setting only decides whether
// they are also shown while the app is open (the in-app overlay covers that).
let showRestNotificationInForeground = false;

export function setShowRestNotificationInForeground(show: boolean) {
  showRestNotificationInForeground = show;
}

/** Foreground behaviour for Notifications.setNotificationHandler. */
export function foregroundPresentation(
  notification: Notifications.Notification,
): Notifications.NotificationBehavior {
  const show =
    showRestNotificationInForeground &&
    notification.request.content.data?.kind === REST_NOTIFICATION_KIND;
  return {
    shouldPlaySound: show,
    shouldSetBadge: false,
    shouldShowBanner: show,
    shouldShowList: show,
  };
}

/** Asks for notification permission only while the OS still allows asking. */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error: any) {
    Bugsnag.notify(error);
    return false;
  }
}

/**
 * Schedules the rest notification when a rest timer starts, asking for
 * permission the first time. When notifications are blocked,
 * `showPermissionHint` is true exactly once so the overlay can explain.
 */
export async function startRestNotification(
  secondsFromNow: number,
  title: string,
  body: string,
): Promise<{ showPermissionHint: boolean }> {
  if (await ensureNotificationPermission()) {
    await scheduleRestNotificationWithCancellation(secondsFromNow, title, body);
    return { showPermissionHint: false };
  }
  await cancelRestNotifications();
  if (await getAsyncStorageItem(PERMISSION_HINT_SHOWN_KEY)) {
    return { showPermissionHint: false };
  }
  await setAsyncStorageItem(PERMISSION_HINT_SHOWN_KEY, "true");
  return { showPermissionHint: true };
}
