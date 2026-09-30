import {
  BACKUP_REMINDER_SNOOZE_DAYS,
  getBackupReminder,
  snoozeUntil,
} from "../backupReminder";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-30T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

const base = {
  isSignedIn: true,
  workoutCount: 10,
  lastBackup: { date: null as Date | null },
  workoutsSinceBackup: 0,
  snoozedUntil: undefined as string | undefined,
  workoutInProgress: false,
  now,
};

describe("getBackupReminder", () => {
  describe("signed out", () => {
    const signedOut = { ...base, isSignedIn: false, lastBackup: undefined };

    it("reminds once five workouts are logged", () => {
      expect(getBackupReminder({ ...signedOut, workoutCount: 5 })).toEqual({
        reason: "signedOutNoBackup",
      });
    });

    it("stays quiet below five workouts", () => {
      expect(getBackupReminder({ ...signedOut, workoutCount: 4 })).toBeNull();
    });
  });

  describe("signed in, never backed up", () => {
    it("reminds once three workouts are logged", () => {
      expect(getBackupReminder({ ...base, workoutCount: 3 })).toEqual({
        reason: "neverBackedUp",
      });
    });

    it("stays quiet below three workouts", () => {
      expect(getBackupReminder({ ...base, workoutCount: 2 })).toBeNull();
    });

    it("stays quiet while the backup date is unknown", () => {
      expect(getBackupReminder({ ...base, lastBackup: undefined })).toBeNull();
    });
  });

  describe("signed in, backed up before", () => {
    const backedUp = (days: number, since: number) => ({
      ...base,
      lastBackup: { date: daysAgo(days) },
      workoutsSinceBackup: since,
    });

    it("reminds when the backup is over 30 days old with workouts since", () => {
      expect(getBackupReminder(backedUp(45, 12))).toEqual({
        reason: "stale",
        daysSinceBackup: 45,
        workoutsSinceBackup: 12,
      });
    });

    it("stays quiet at exactly 30 days", () => {
      expect(getBackupReminder(backedUp(30, 12))).toBeNull();
    });

    it("stays quiet when nothing was logged since the backup", () => {
      expect(getBackupReminder(backedUp(45, 0))).toBeNull();
    });

    it("stays quiet for a recent backup", () => {
      expect(getBackupReminder(backedUp(3, 2))).toBeNull();
    });
  });

  describe("snooze", () => {
    it("hides the reminder until the snooze date passes", () => {
      const snoozedUntil = daysAgo(-1).toISOString();
      expect(getBackupReminder({ ...base, snoozedUntil })).toBeNull();
    });

    it("shows it again once the snooze date has passed", () => {
      const snoozedUntil = daysAgo(1).toISOString();
      expect(getBackupReminder({ ...base, snoozedUntil })).toEqual({
        reason: "neverBackedUp",
      });
    });

    it("ignores an unreadable snooze value", () => {
      expect(getBackupReminder({ ...base, snoozedUntil: "soon" })).toEqual({
        reason: "neverBackedUp",
      });
    });
  });

  it("never reminds while a workout is in progress", () => {
    expect(getBackupReminder({ ...base, workoutInProgress: true })).toBeNull();
    expect(
      getBackupReminder({
        ...base,
        isSignedIn: false,
        workoutInProgress: true,
      }),
    ).toBeNull();
  });
});

describe("snoozeUntil", () => {
  it("snoozes Later for 14 days", () => {
    expect(BACKUP_REMINDER_SNOOZE_DAYS).toBe(14);
    expect(snoozeUntil("later", now)).toBe(daysAgo(-14).toISOString());
  });

  it("puts Don't remind me far in the future", () => {
    const until = new Date(snoozeUntil("never", now));
    expect(until.getUTCFullYear()).toBeGreaterThan(2100);
  });
});
