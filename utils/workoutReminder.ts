import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Bugsnag from "@bugsnag/expo";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";

const WORKOUT_REMINDER_IDS_KEY = "workoutReminderIds";
const CHANNEL_ID = "workout-reminders";

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function cancelWorkoutReminders(): Promise<void> {
  try {
    const raw = await getAsyncStorageItem(WORKOUT_REMINDER_IDS_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      await removeAsyncStorageItem(WORKOUT_REMINDER_IDS_KEY);
    }

    // Failsafe: cancel any workout reminders not tracked in storage
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.title === "Time to train!")
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to cancel workout reminders:", error);
  }
}

async function scheduleWorkoutReminders(
  days: number[],
  time: string,
): Promise<void> {
  if (days.length === 0) return;

  const parts = time.split(":");
  const hour = parseInt(parts[0] ?? "8", 10);
  const minute = parseInt(parts[1] ?? "0", 10);

  if (
    isNaN(hour) ||
    isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    const err = new Error(`Invalid workout reminder time: "${time}"`);
    Bugsnag.notify(err);
    console.error(err.message);
    return;
  }

  await cancelWorkoutReminders();

  const ids: string[] = [];
  for (const day of days) {
    // expo-notifications weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
    const weekday = (day % 7) + 1;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time to train!",
          body: "Your workout is scheduled for today. Let's go!",
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
          ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
        },
      });
      ids.push(id);
    } catch (error: any) {
      Bugsnag.notify(error);
      console.error(`Failed to schedule reminder for day ${day}:`, error);
    }
  }

  if (ids.length > 0) {
    await setAsyncStorageItem(WORKOUT_REMINDER_IDS_KEY, JSON.stringify(ids));
  }
}

export async function rescheduleWorkoutReminders(
  enabled: string,
  days: string,
  time: string,
): Promise<void> {
  if (enabled !== "true") {
    await cancelWorkoutReminders();
    return;
  }

  let parsedDays: number[] = [];
  try {
    const raw = JSON.parse(days || "[]");
    parsedDays = Array.isArray(raw)
      ? [
          ...new Set(
            raw
              .map((d: unknown) => (typeof d === "number" ? d : Number(d)))
              .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6),
          ),
        ].sort((a, b) => a - b)
      : [];
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to parse workoutReminderDays:", error);
    parsedDays = [];
  }

  if (parsedDays.length === 0) {
    await cancelWorkoutReminders();
    return;
  }

  await scheduleWorkoutReminders(parsedDays, time);
}
