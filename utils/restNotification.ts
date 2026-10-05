import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Bugsnag from "@bugsnag/expo";
import {
  getAsyncStorageItem,
  setAsyncStorageItem,
  removeAsyncStorageItem,
} from "@/utils/asyncStorage";
import { canScheduleExactAlarms } from "@/modules/exact-alarm";

const REST_TIMER_NOTIFICATION_ID_KEY = "restTimerNotificationId";
const PERMISSION_HINT_SHOWN_KEY = "restNotificationPermissionHintShown";
const PERMISSION_ASKED_KEY = "restNotificationPermissionAsked";
const EXACT_ALARM_HINT_SHOWN_KEY = "restNotificationExactAlarmHintShown";

/** `content.data.kind` of rest timer notifications. */
export const REST_NOTIFICATION_KIND = "rest-timer";

export async function scheduleRestNotification(
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string = "rest-timer1",
) {
  if (secondsFromNow <= 0) {
    return;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: REST_NOTIFICATION_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
        ...(Platform.OS === "android" && { channelId }),
      },
    });
    await setAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY, id);
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to schedule notification:", error);
  }
}

// Timer starts, adjustments and cancels can overlap (a rest starts while the
// previous one is still being scheduled, +15s is tapped straight away). Each
// request takes a ticket and replacements run one at a time; a replacement
// whose ticket is no longer the newest does nothing, so only the latest
// notification is ever scheduled and stored.
let latestTicket = 0;
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function replaceRestNotification(
  ticket: number,
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string,
) {
  await serialize(async () => {
    if (ticket !== latestTicket) return;
    await cancelScheduledRestNotification();
    if (secondsFromNow > 0) {
      await scheduleRestNotification(secondsFromNow, title, body, channelId);
    }
  });
}

export async function cancelRestNotifications() {
  latestTicket++;
  await serialize(cancelScheduledRestNotification);
}

async function cancelScheduledRestNotification() {
  try {
    const id = await getAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await removeAsyncStorageItem(REST_TIMER_NOTIFICATION_ID_KEY);
      await Notifications.dismissNotificationAsync(id);
    }
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Failed to cancel notifications:", error);
  }
}

/**
 * Cancels any existing rest notifications and schedules a new one.
 * This wrapper ensures the cancel-then-schedule contract is always enforced.
 * @param secondsFromNow how many seconds in the future the notification should fire
 * @param title notification title
 * @param body notification body
 * @param channelId must match the channel you created (on Android)
 */
export async function scheduleRestNotificationWithCancellation(
  secondsFromNow: number,
  title: string,
  body: string,
  channelId: string = "rest-timer1",
) {
  await replaceRestNotification(
    ++latestTicket,
    secondsFromNow,
    title,
    body,
    channelId,
  );
}

// Rest notifications are always scheduled, so a backgrounded or locked phone
// still gets its cue. The "restTimerNotification" setting only decides whether
// they are also shown while the app is open (the in-app overlay covers that).
let showRestNotificationInForeground = false;

export function setShowRestNotificationInForeground(show: boolean) {
  showRestNotificationInForeground = show;
}

/** Foreground behaviour for Notifications.setNotificationHandler. */
export function foregroundPresentation(
  notification: Notifications.Notification,
): Notifications.NotificationBehavior {
  const show =
    showRestNotificationInForeground &&
    notification.request.content.data?.kind === REST_NOTIFICATION_KIND;
  return {
    shouldPlaySound: show,
    shouldSetBadge: false,
    shouldShowBanner: show,
    shouldShowList: show,
  };
}

/**
 * Asks for notification permission once, ever: Android keeps canAskAgain true
 * after the first denial, and a second prompt mid-workout would nag.
 */
async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    if (await getAsyncStorageItem(PERMISSION_ASKED_KEY)) return false;
    const requested = await Notifications.requestPermissionsAsync();
    // Marked only once the user has actually answered; a failed request is
    // retried at the next rest.
    await setAsyncStorageItem(PERMISSION_ASKED_KEY, "true");
    return requested.granted;
  } catch (error: any) {
    Bugsnag.notify(error);
    return false;
  }
}

/** Safe to call anywhere: a failed native check counts as allowed. */
export function exactAlarmsAllowed(): boolean {
  try {
    return canScheduleExactAlarms();
  } catch (error: any) {
    Bugsnag.notify(error);
    return true;
  }
}

/**
 * Without "Alarms & reminders" (not granted by default on Android 14+),
 * expo-notifications falls back to an inexact alarm that can fire well after
 * the rest ends. True once, ever, so the overlay can offer the setting.
 */
let exactAlarmHintClaimInFlight = false;

async function claimExactAlarmHint(): Promise<boolean> {
  if (Platform.OS !== "android" || exactAlarmsAllowed()) return false;
  // Overlapping rests must not both read "not shown" before either writes it.
  // Taken synchronously; released afterwards, when the stored flag decides.
  if (exactAlarmHintClaimInFlight) return false;
  exactAlarmHintClaimInFlight = true;
  try {
    if (await getAsyncStorageItem(EXACT_ALARM_HINT_SHOWN_KEY)) return false;
    await setAsyncStorageItem(EXACT_ALARM_HINT_SHOWN_KEY, "true");
    return true;
  } finally {
    exactAlarmHintClaimInFlight = false;
  }
}

/**
 * Schedules the rest notification when a rest timer starts, asking for
 * permission the first time. When notifications are blocked,
 * `showPermissionHint` is true exactly once so the overlay can explain; when
 * they are allowed but alerts would be inexact, `showExactAlarmHint` is.
 */
export async function startRestNotification(
  secondsFromNow: number,
  title: string,
  body: string,
): Promise<{ showPermissionHint: boolean; showExactAlarmHint: boolean }> {
  // Taken before the permission check, so a newer timer started meanwhile wins.
  const ticket = ++latestTicket;
  if (await ensureNotificationPermission()) {
    await replaceRestNotification(
      ticket,
      secondsFromNow,
      title,
      body,
      "rest-timer1",
    );
    return {
      showPermissionHint: false,
      showExactAlarmHint: await claimExactAlarmHint(),
    };
  }
  await cancelRestNotifications();
  if (await getAsyncStorageItem(PERMISSION_HINT_SHOWN_KEY)) {
    return { showPermissionHint: false, showExactAlarmHint: false };
  }
  await setAsyncStorageItem(PERMISSION_HINT_SHOWN_KEY, "true");
  return { showPermissionHint: true, showExactAlarmHint: false };
}
