import {
  requestNotificationPermission,
  rescheduleWorkoutReminders,
} from "../workoutReminder";
import * as Notifications from "expo-notifications";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";
import Bugsnag from "@bugsnag/expo";

jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
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
// requestNotificationPermission
// ---------------------------------------------------------------------------

describe("requestNotificationPermission", () => {
  it("returns true when permission is granted", async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    const result = await requestNotificationPermission();
    expect(result).toBe(true);
  });

  it("returns false when permission is denied", async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rescheduleWorkoutReminders — disabled path
// ---------------------------------------------------------------------------

describe("rescheduleWorkoutReminders (disabled)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAsyncStorageItem as jest.Mock).mockResolvedValue(null);
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);
    (removeAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("cancels reminders and does not schedule when enabled is 'false'", async () => {
    await rescheduleWorkoutReminders("false", "[1,2,3]", "08:00");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancels reminders and does not schedule when enabled is empty string", async () => {
    await rescheduleWorkoutReminders("", "[1]", "08:00");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// rescheduleWorkoutReminders — enabled path
// ---------------------------------------------------------------------------

describe("rescheduleWorkoutReminders (enabled)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAsyncStorageItem as jest.Mock).mockResolvedValue(null);
    (
      Notifications.getAllScheduledNotificationsAsync as jest.Mock
    ).mockResolvedValue([]);
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
      "reminder-id",
    );
    (removeAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
    (setAsyncStorageItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("schedules a WEEKLY notification per day", async () => {
    await rescheduleWorkoutReminders("true", "[1,3]", "07:30");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          type: "weekly",
          hour: 7,
          minute: 30,
        }),
      }),
    );
  });

  it("saves scheduled notification IDs to AsyncStorage", async () => {
    await rescheduleWorkoutReminders("true", "[0]", "08:00");
    expect(setAsyncStorageItem).toHaveBeenCalledWith(
      "workoutReminderIds",
      expect.any(String),
    );
  });

  it("does not schedule when days array is empty", async () => {
    await rescheduleWorkoutReminders("true", "[]", "08:00");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("does not schedule when days string is invalid JSON", async () => {
    await rescheduleWorkoutReminders("true", "not-json", "08:00");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalled();
  });

  it("does not schedule when time is invalid", async () => {
    await rescheduleWorkoutReminders("true", "[1]", "25:99");
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Bugsnag.notify).toHaveBeenCalled();
  });

  it("deduplicates day values", async () => {
    // Repeated day 1 should only schedule once
    await rescheduleWorkoutReminders("true", "[1,1,1]", "09:00");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
