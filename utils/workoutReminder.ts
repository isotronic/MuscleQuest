import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Bugsnag from "@bugsnag/expo";
import { t } from "@lingui/core/macro";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";

const WORKOUT_REMINDER_IDS_KEY = "workoutReminderIds";
const CHANNEL_ID = "workout-reminders";
// Reminders are tagged with this in their data so the fallback scan finds
// them whatever language their title was written in.
const WORKOUT_REMINDER_KIND = "workoutReminder";
// Title of reminders scheduled before they were tagged and translated.
const LEGACY_WORKOUT_REMINDER_TITLE = "Time to train!";

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function cancelWorkoutReminders(): Promise<void> {
  // Cancel tracked IDs; parse/cancel failures must not prevent the fallback scan.
  try {
    const raw = await getAsyncStorageItem(WORKOUT_REMINDER_IDS_KEY);
    let ids: string[] = [];
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          ids = parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch {
        // Corrupted storage — treat as empty; fallback scan will catch strays.
      }
    }
    await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    await removeAsyncStorageItem(WORKOUT_REMINDER_IDS_KEY);
  } catch (error: unknown) {
    Bugsnag.notify(error as Error);
    console.error("Failed to cancel tracked workout reminders:", error);
  }

  // Failsafe: always runs regardless of errors above.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.allSettled(
      scheduled
        .filter(
          (n) =>
            n.content.data?.kind === WORKOUT_REMINDER_KIND ||
            n.content.title === LEGACY_WORKOUT_REMINDER_TITLE,
        )
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );
  } catch (error: unknown) {
    Bugsnag.notify(error as Error);
    console.error("Failed to cancel untracked workout reminders:", error);
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

  // Built here rather than at import so the text follows the active catalog.
  // Reminders are rescheduled on every boot, which picks up a language change.
  const title = t`Time to train!`;
  const body = t`Your workout is scheduled for today. Let's go!`;

  const ids: string[] = [];
  for (const day of days) {
    // expo-notifications weekday: 1=Sunday, 2=Monday, ..., 7=Saturday
    const weekday = (day % 7) + 1;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { kind: WORKOUT_REMINDER_KIND },
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
