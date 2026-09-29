import * as Notifications from "expo-notifications";
import { setupNotificationChannel } from "../notificationSetup";
import {
  REST_NOTIFICATION_KIND,
  setShowRestNotificationInForeground,
} from "../restNotification";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4 },
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
});
