export type BackupReminderReason =
  | "signedOutNoBackup"
  | "neverBackedUp"
  | "stale";

export type BackupReminder =
  | { reason: "signedOutNoBackup" }
  | { reason: "neverBackedUp" }
  | { reason: "stale"; daysSinceBackup: number; workoutsSinceBackup: number };

export const SIGNED_OUT_MIN_WORKOUTS = 5;
export const NEVER_BACKED_UP_MIN_WORKOUTS = 3;
export const STALE_BACKUP_DAYS = 30;
export const BACKUP_REMINDER_SNOOZE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupReminderInputs {
  isSignedIn: boolean;
  /** Completed workouts on this device. */
  workoutCount: number;
  /**
   * `{ date: null }` means the account has no backup. `undefined` means it is
   * not known yet (loading, offline, failed), which never shows a reminder.
   */
  lastBackup: { date: Date | null } | undefined;
  workoutsSinceBackup: number;
  /** The `backupReminderSnoozedUntil` setting, an ISO instant. */
  snoozedUntil: string | undefined;
  workoutInProgress: boolean;
  now?: Date;
}

/** Which backup reminder to show on the home screen, if any. */
export function getBackupReminder({
  isSignedIn,
  workoutCount,
  lastBackup,
  workoutsSinceBackup,
  snoozedUntil,
  workoutInProgress,
  now = new Date(),
}: BackupReminderInputs): BackupReminder | null {
  if (workoutInProgress) return null;

  const snoozedUntilMs = snoozedUntil ? Date.parse(snoozedUntil) : NaN;
  if (Number.isFinite(snoozedUntilMs) && snoozedUntilMs > now.getTime()) {
    return null;
  }

  if (!isSignedIn) {
    return workoutCount >= SIGNED_OUT_MIN_WORKOUTS
      ? { reason: "signedOutNoBackup" }
      : null;
  }

  if (!lastBackup) return null;

  if (lastBackup.date === null) {
    return workoutCount >= NEVER_BACKED_UP_MIN_WORKOUTS
      ? { reason: "neverBackedUp" }
      : null;
  }

  const daysSinceBackup = Math.floor(
    (now.getTime() - lastBackup.date.getTime()) / DAY_MS,
  );
  if (daysSinceBackup > STALE_BACKUP_DAYS && workoutsSinceBackup >= 1) {
    return { reason: "stale", daysSinceBackup, workoutsSinceBackup };
  }
  return null;
}

/** The value to store in `backupReminderSnoozedUntil`. */
export function snoozeUntil(
  kind: "later" | "never",
  now: Date = new Date(),
): string {
  return kind === "never"
    ? "9999-12-31T00:00:00.000Z"
    : new Date(
        now.getTime() + BACKUP_REMINDER_SNOOZE_DAYS * DAY_MS,
      ).toISOString();
}
