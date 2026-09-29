import {
  scheduleRestNotification,
  cancelRestNotifications,
  scheduleRestNotificationWithCancellation,
  startRestNotification,
  foregroundPresentation,
  setShowRestNotificationInForeground,
  REST_NOTIFICATION_KIND,
} from "../restNotification";
import * as Notifications from "expo-notifications";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";
import Bugsnag from "@bugsnag/expo";

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));
jest.mock("@/utils/asyncStorage", () => ({
  getAsyncStorageItem: jest.fn(),
  setAsyncStorageItem: jest.fn(),
  removeAsyncStorageItem: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

// ---------------------------------------------------------------------------
// scheduleRestNotification
// ---------------------------------------------------------------------------

describe("scheduleRestNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      "mock-notification-id",
    );
    (setAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns early without scheduling when secondsFromNow <= 0", async () => {
    await scheduleRestNotification(0, "Rest", "Take a break");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("returns early for negative secondsFromNow", async () => {
    await scheduleRestNotification(-10, "Rest", "Take a break");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules a TIME_INTERVAL notification", async () => {
    await scheduleRestNotification(60, "Rest done", "Start your set");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          title: "Rest done",
          body: "Start your set",
          data: { kind: "rest-timer" },
        },
        trigger: expect.objectContaining({
          type: "timeInterval",
          seconds: 60,
          repeats: false,
        }),
      }),
    );
  });

  it("saves the returned notification id in AsyncStorage", async () => {
    await scheduleRestNotification(30, "Title", "Body");
    expect(setAsyncStorageItem).toHaveBeenCalledWith(
      "restTimerNotificationId",
      "mock-notification-id",
    );
  });

  it("notifies Bugsnag when scheduling throws", async () => {
    const error = new Error("scheduling failed");
    (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
      error,
    );
    await scheduleRestNotification(30, "Title", "Body");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// cancelRestNotifications
// ---------------------------------------------------------------------------

describe("cancelRestNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      Notifications.cancelScheduledNotificationAsync as jest.Mock
    ).mockResolvedValue(undefined);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(
      undefined,
    );
    (removeAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("does nothing when there is no stored notification id", async () => {
    (getAsyncStorageItem as jest.Mock).mockResolvedValue(null);
    await cancelRestNotifications();
    expect(
      Notifications.cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalled();
    expect(removeAsyncStorageItem).not.toHaveBeenCalled();
  });

  it("cancels, dismisses, and removes the stored notification", async () => {
    (getAsyncStorageItem as jest.Mock).mockResolvedValue("stored-id");
    await cancelRestNotifications();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "stored-id",
    );
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
      "stored-id",
    );
    expect(removeAsyncStorageItem).toHaveBeenCalledWith(
      "restTimerNotificationId",
    );
  });

  it("notifies Bugsnag on error", async () => {
    const error = new Error("cancel failed");
    (getAsyncStorageItem as jest.Mock).mockRejectedValue(error);
    await cancelRestNotifications();
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// scheduleRestNotificationWithCancellation
// ---------------------------------------------------------------------------

describe("scheduleRestNotificationWithCancellation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAsyncStorageItem as jest.Mock).mockResolvedValue(null);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      "new-id",
    );
    (setAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("always cancels existing notifications first", async () => {
    (getAsyncStorageItem as jest.Mock).mockResolvedValue("old-id");
    (
      Notifications.cancelScheduledNotificationAsync as jest.Mock
    ).mockResolvedValue(undefined);
    (Notifications.dismissNotificationAsync as jest.Mock).mockResolvedValue(
      undefined,
    );
    (removeAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);

    await scheduleRestNotificationWithCancellation(60, "Title", "Body");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "old-id",
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it("does not schedule when secondsFromNow is 0", async () => {
    await scheduleRestNotificationWithCancellation(0, "Title", "Body");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules when secondsFromNow is positive", async () => {
    await scheduleRestNotificationWithCancellation(90, "Rest Over", "Go!");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// startRestNotification
// ---------------------------------------------------------------------------

describe("startRestNotification", () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
    (getAsyncStorageItem as jest.Mock).mockImplementation(
      async (k: string) => storage[k] ?? "",
    );
    (setAsyncStorageItem as jest.Mock).mockImplementation(
      async (k: string, v: string) => {
        storage[k] = v;
      },
    );
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      "id-1",
    );
  });

  const permission = (granted: boolean, canAskAgain = true) => ({
    granted,
    canAskAgain,
    status: granted ? "granted" : "undetermined",
  });

  it("schedules a tagged notification when permission is granted, whatever the setting", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(
      permission(true),
    );

    const result = await startRestNotification(90, "Rest", "Go");

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: { kind: REST_NOTIFICATION_KIND },
        }),
        trigger: expect.objectContaining({ seconds: 90 }),
      }),
    );
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ showPermissionHint: false });
  });

  it("replaces a pending rest notification when rescheduled", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(
      permission(true),
    );
    await startRestNotification(90, "Rest", "Go");
    await startRestNotification(60, "Rest", "Go");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "id-1",
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("asks for permission the first time a rest timer starts", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(
      permission(false),
    );
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue(
      permission(true),
    );

    await startRestNotification(90, "Rest", "Go");

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it("returns a hint once when permission is denied", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue(
      permission(false, false),
    );

    const first = await startRestNotification(90, "Rest", "Go");
    const second = await startRestNotification(90, "Rest", "Go");

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(first).toEqual({ showPermissionHint: true });
    expect(second).toEqual({ showPermissionHint: false });
  });
});

// ---------------------------------------------------------------------------
// foregroundPresentation
// ---------------------------------------------------------------------------

describe("foregroundPresentation", () => {
  const notification = (data: Record<string, unknown>) =>
    ({ request: { content: { data } } }) as any;

  afterEach(() => setShowRestNotificationInForeground(false));

  it("hides rest notifications in the foreground by default", () => {
    expect(
      foregroundPresentation(notification({ kind: REST_NOTIFICATION_KIND })),
    ).toEqual(
      expect.objectContaining({
        shouldShowBanner: false,
        shouldPlaySound: false,
      }),
    );
  });

  it("shows rest notifications in the foreground when the setting is on", () => {
    setShowRestNotificationInForeground(true);
    expect(
      foregroundPresentation(notification({ kind: REST_NOTIFICATION_KIND })),
    ).toEqual(
      expect.objectContaining({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
      }),
    );
  });

  it("keeps other notifications hidden in the foreground", () => {
    setShowRestNotificationInForeground(true);
    expect(foregroundPresentation(notification({}))).toEqual(
      expect.objectContaining({ shouldShowBanner: false }),
    );
  });
});
