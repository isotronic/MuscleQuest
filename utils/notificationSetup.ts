import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  foregroundPresentation,
  REST_TIMER_CHANNEL_ID,
} from "@/utils/restNotification";

export const setupNotificationChannel = async () => {
  // While the app is open, only rest notifications can show, and only when
  // the user asked for them (see foregroundPresentation).
  await Notifications.setNotificationHandler({
    handleNotification: async (notification) =>
      foregroundPresentation(notification),
  });

  if (Platform.OS === "android") {
    // Replaced by REST_TIMER_CHANNEL_ID, whose sound plays on silent.
    await Notifications.deleteNotificationChannelAsync("rest-timer1");
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: "Rest Timer Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 100, 400, 100, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "boxing_bell.mp3",
      // The alarm stream is not muted by silent mode; Do Not Disturb still
      // applies.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      enableVibrate: true,
      enableLights: true,
    });
    await Notifications.setNotificationChannelAsync("workout-reminders", {
      name: "Workout Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
    });
  }
};
