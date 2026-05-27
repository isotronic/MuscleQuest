import {
  scheduleRestNotification,
  cancelRestNotifications,
  scheduleRestNotificationWithCancellation,
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
        content: { title: "Rest done", body: "Start your set" },
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
