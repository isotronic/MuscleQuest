import * as Notifications from "expo-notifications";

/**
 * Schedules a local notification to fire in `secondsFromNow`.
 * @param secondsFromNow how many seconds in the future the notification should fire
 * @param title notification title
 * @param body notification body
 * @param channelId must match the channel you created (on Android)
 */
export async function scheduleRestNotification(
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string = "rest-timer1",
) {
  // If the user tries to schedule for 0 or negative, ignore or handle.
  if (secondsFromNow <= 0) {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        // sound: "boxing_bell.mp3",
      },
      trigger: {
        seconds: secondsFromNow,
        channelId, // important on Android to match the channel created
      },
    });
  } catch (error) {
    console.error("Failed to schedule notification:", error);
  }
}

export async function cancelRestNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Failed to cancel notifications:", error);
  }
}
