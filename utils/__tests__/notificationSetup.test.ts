import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { setupNotificationChannel } from "../notificationSetup";
import {
  REST_NOTIFICATION_KIND,
  REST_TIMER_CHANNEL_ID,
  setShowRestNotificationInForeground,
} from "../restNotification";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  deleteNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
}));

describe("setupNotificationChannel", () => {
  afterEach(() => setShowRestNotificationInForeground(false));

  it("shows rest notifications in the foreground only when the setting allows it", async () => {
    await setupNotificationChannel();
    const { handleNotification } = (
      Notifications.setNotificationHandler as jest.Mock
    ).mock.calls[0][0];
    const rest = {
      request: { content: { data: { kind: REST_NOTIFICATION_KIND } } },
    };

    expect((await handleNotification(rest)).shouldShowBanner).toBe(false);
    setShowRestNotificationInForeground(true);
    expect((await handleNotification(rest)).shouldShowBanner).toBe(true);
  });

  it("plays rest alerts on the alarm stream so silent mode does not mute them", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    try {
      await setupNotificationChannel();
    } finally {
      Platform.OS = os;
    }

    expect(Notifications.deleteNotificationChannelAsync).toHaveBeenCalledWith(
      "rest-timer1",
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      REST_TIMER_CHANNEL_ID,
      expect.objectContaining({
        sound: "boxing_bell.mp3",
        audioAttributes: { usage: 4, contentType: 4 },
      }),
    );
  });
});
