import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    console.warn("Notification permission not granted!");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("rest-timer", {
      name: "Rest Timer Notifications",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 100, 400, 100, 600],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "boxing-bell.mp3",
    });
  }
};
