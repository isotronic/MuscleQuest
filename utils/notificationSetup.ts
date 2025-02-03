import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const setupNotificationChannel = async () => {
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
  }
};
