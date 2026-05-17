import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Bugsnag from "@bugsnag/expo";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";

const REST_TIMER_NOTIFICATION_ID_KEY = "restTimerNotificationId";

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
