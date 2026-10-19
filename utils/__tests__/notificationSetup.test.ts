import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { setupNotificationChannel } from "../notificationSetup";
import {
  REST_NOTIFICATION_KIND,
  REST_TIMER_ALARM_CHANNEL_ID,
  REST_TIMER_CHANNEL_ID,
  setShowRestNotificationInForeground,
} from "../restNotification";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
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

  it("creates the rest channel and an alarm-stream twin that sounds on silent", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    try {
      await setupNotificationChannel();
    } finally {
      Platform.OS = os;
    }

    const calls = (Notifications.setNotificationChannelAsync as jest.Mock).mock
      .calls;
    const normal = calls.find(([id]) => id === REST_TIMER_CHANNEL_ID)?.[1];
    const alarm = calls.find(([id]) => id === REST_TIMER_ALARM_CHANNEL_ID)?.[1];
    expect(normal).toEqual(
      expect.objectContaining({ sound: "boxing_bell.mp3" }),
    );
    expect(normal.audioAttributes).toBeUndefined();
    expect(alarm).toEqual(
      expect.objectContaining({
        sound: "boxing_bell.mp3",
        audioAttributes: { usage: 4, contentType: 4 },
      }),
    );
  });
});
