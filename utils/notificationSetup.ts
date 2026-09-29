import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { foregroundPresentation } from "@/utils/restNotification";

export const setupNotificationChannel = async () => {
  // While the app is open, only rest notifications can show, and only when
  // the user asked for them (see foregroundPresentation).
  await Notifications.setNotificationHandler({
    handleNotification: async (notification) =>
      foregroundPresentation(notification),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rest-timer1", {
      name: "Rest Timer Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 100, 400, 100, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "boxing_bell.mp3",
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
