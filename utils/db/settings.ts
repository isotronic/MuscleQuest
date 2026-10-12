import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import { kgToDisplay } from "@/utils/units";
import {
  DEFAULT_BAR_WEIGHT_KG,
  DEFAULT_BAR_WEIGHT_LBS,
  DEFAULT_PLATE_INVENTORY_KG,
  DEFAULT_PLATE_INVENTORY_LBS,
} from "@/utils/plateCalculator";
import {
  changeWeekStart,
  weekRuleFromSettings,
  weekRuleToSettings,
  type WeekRule,
  type WeekStartDay,
} from "@/utils/week";
import { localeDefaults } from "@/utils/localeDefaults";
import { SETUP_DONE_KEY, SetupState } from "@/utils/setupState";
import { openDatabase } from "./connection";

/**
 * Inserts every setting that is missing; a stored value is never replaced.
 * Runs on every boot, also after restoring an old backup.
 *
 * A new install is one that has not passed the login screen (login.tsx
 * writes loginShown). It gets units, weight steps and week start from the
 * device region, no body weight until the user enters one, and the setup
 * screen. An older install keeps the values it had and is offered setup.
 */
export const insertDefaultSettings = async () => {
  const db = await openDatabase("userData.db");
  try {
    const isNewInstall = !(await db.getFirstAsync(
      "SELECT 1 FROM settings WHERE key = 'loginShown'",
    ));
    const fromLocale = isNewInstall ? localeDefaults() : null;
    const defaultSettings = [
      { key: "weeklyGoal", value: "3" },
      // Monday weeks for an older install, as before the setting existed.
      { key: "weekStartsOn", value: fromLocale?.weekStartsOn ?? "1" },
      {
        key: SETUP_DONE_KEY,
        value: isNewInstall ? SetupState.pending : SetupState.offered,
      },
      { key: "keepScreenOn", value: "false" },
      { key: "downloadImages", value: "false" },
      { key: "weightUnit", value: fromLocale?.weightUnit ?? "kg" },
      { key: "distanceUnit", value: fromLocale?.distanceUnit ?? "m" },
      { key: "sizeUnit", value: fromLocale?.sizeUnit ?? "cm" },
      { key: "weightIncrement", value: fromLocale?.weightIncrement ?? "1" },
      { key: "defaultSets", value: "3" },
      { key: "defaultRestTime", value: "60" },
      { key: "buttonSize", value: "Standard" },
      { key: "timeRange", value: "30" },
      { key: "restTimerVibration", value: "false" },
      { key: "restTimerSound", value: "false" },
      { key: "restTimerNotification", value: "false" },
      { key: "restTimerIncrement", value: "15" },
      // No loginShown or bodyWeight: login.tsx sets the first, and body
      // weight stays unset until entered, so it never feeds a made-up 70 kg
      // into assisted-exercise numbers.
      { key: "showOnboarding", value: "true" },
      { key: "timerCountdown", value: "5" },
      { key: "workoutReminderEnabled", value: "false" },
      { key: "workoutReminderDays", value: "[]" },
      { key: "workoutReminderTime", value: "08:00" },
      { key: "excludeWarmupSets", value: "false" },
      { key: "countUnilateralDouble", value: "true" },
      { key: "doubleWeightForPaired", value: "true" },
      { key: "timerCountdownSound", value: "false" },
      { key: "timerGoalSound", value: "false" },
      { key: "alwaysUseGlobalHistory", value: "false" },
      { key: "plansViewMode", value: "carousel" },
      { key: "adaptive_progression_enabled", value: "0" },
      { key: "progression_increment_barbell_kg", value: "2.5" },
      { key: "progression_increment_dumbbell_kg", value: "2.0" },
      { key: "progression_increment_cable_kg", value: "2.5" },
      { key: "progression_increment_machine_kg", value: "2.5" },
      { key: "exclude_deload_from_stats", value: "0" },
      {
        key: "plateInventoryKg",
        value: JSON.stringify(DEFAULT_PLATE_INVENTORY_KG),
      },
      {
        key: "plateInventoryLbs",
        value: JSON.stringify(DEFAULT_PLATE_INVENTORY_LBS),
      },
      { key: "plateCalcBarKg", value: String(DEFAULT_BAR_WEIGHT_KG) },
      { key: "plateCalcBarLbs", value: String(DEFAULT_BAR_WEIGHT_LBS) },
    ];

    // Loop through each default setting
    for (const setting of defaultSettings) {
      // Check if the setting already exists in the database
      const existingSetting = await db.getFirstAsync(
        "SELECT value FROM settings WHERE key = ?",
        [setting.key],
      );

      // If the setting doesn't exist, insert it
      if (!existingSetting) {
        await db.runAsync("INSERT INTO settings (key, value) VALUES (?, ?)", [
          setting.key,
          setting.value,
        ]);
      }
    }
  } finally {
    await db.closeAsync();
  }
};

interface SettingsResult {
  key: string;
  value: string;
}

export interface Settings {
  weeklyGoal: string;
  keepScreenOn: string;
  downloadImages: string;
  weightUnit: string;
  distanceUnit: string;
  sizeUnit: string;
  weightIncrement: string;
  defaultSets: string;
  defaultRestTime: string;
  buttonSize: string;
  timeRange: string;
  dataVersion: string;
  restTimerVibration: string;
  restTimerSound: string;
  restTimerNotification: string;
  restTimerIncrement: string;
  /** Absent until the user enters a body weight. */
  bodyWeight?: string;
  /** Absent until the login screen was passed. */
  loginShown?: string;
  /** See utils/setupState.ts. */
  setupDone?: string;
  showOnboarding: string;
  lastSeenVersion: string;
  timerCountdown: string;
  workoutReminderEnabled: string;
  workoutReminderDays: string;
  workoutReminderTime: string;
  excludeWarmupSets: string;
  countUnilateralDouble: string;
  doubleWeightForPaired: string;
  timerCountdownSound: string;
  timerGoalSound: string;
  alwaysUseGlobalHistory: string;
  plansViewMode: string;
  adaptive_progression_enabled: string;
  progression_increment_barbell_kg: string;
  progression_increment_dumbbell_kg: string;
  progression_increment_cable_kg: string;
  progression_increment_machine_kg: string;
  exclude_deload_from_stats: string;
  plateInventoryKg: string;
  plateInventoryLbs: string;
  plateCalcBarKg: string;
  plateCalcBarLbs: string;
  /** ISO instant; the home backup reminder stays hidden until then. */
  backupReminderSnoozedUntil?: string;
  /** JSON, see utils/statsLayout.ts. Absent until the user customises. */
  statsLayout?: string;
  /** Answer to the summary's progression offer, see utils/progressionOffer.ts. */
  progressionOfferAnswered?: string;
  /** "1" Monday or "0" Sunday; read through weekRuleFromSettings. */
  weekStartsOn?: string;
  /** The week start before the last change; "" when there is none. */
  weekStartsOnPrevious?: string;
  /** "YYYY-MM-DD" the last change took effect; "" when there is none. */
  weekStartsOnFrom?: string;
}

export const fetchSettings = async (): Promise<Settings> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");

    const result = (await db.getAllAsync(
      "SELECT * FROM settings",
    )) as SettingsResult[];

    const settings: Partial<Settings> = {};

    result.forEach((row: { key: string; value: string }) => {
      settings[row.key as keyof Settings] = row.value;
    });

    // Stored in kg to 3 decimals so a pound entry round-trips. Returned in
    // the user's unit to one decimal as a canonical string (it fills an
    // input); kg keeps whole numbers bare ("80").
    if (settings.bodyWeight) {
      const kg = Number(settings.bodyWeight);
      settings.bodyWeight =
        settings.weightUnit === "lbs"
          ? kgToDisplay(kg, "lbs").toFixed(1)
          : String(parseFloat(kg.toFixed(1)));
    }

    return settings as Settings;
  } catch (error: any) {
    console.error("Database fetching error:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const updateSettings = async (key: string, value: string) => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [key, value],
    );
  } catch (error: any) {
    console.error("Error updating setting:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

/** One setting's raw value, or null when it is not set. */
export const fetchSetting = async (key: string): Promise<string | null> => {
  const db = await openDatabase("userData.db");
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key],
    );
    return row?.value ?? null;
  } finally {
    await db.closeAsync();
  }
};

export const deleteSetting = async (key: string): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync("DELETE FROM settings WHERE key = ?", [key]);
  } finally {
    await db.closeAsync();
  }
};

const WEEK_RULE_KEYS = [
  "weekStartsOn",
  "weekStartsOnPrevious",
  "weekStartsOnFrom",
] as const;

/** The user's week rule, read on an open connection or transaction. */
export const readWeekRule = async (
  db: SQLite.SQLiteDatabase,
): Promise<WeekRule> => {
  const rows = await db.getAllAsync<SettingsResult>(
    `SELECT key, value FROM settings WHERE key IN (?, ?, ?)`,
    [...WEEK_RULE_KEYS],
  );
  return weekRuleFromSettings(
    Object.fromEntries(rows.map((row) => [row.key, row.value])),
  );
};

/**
 * Sets the user's week start from the next week on (see changeWeekStart),
 * or at once with `immediately`,
 * reading the stored rule and writing all three keys in one transaction.
 */
export const saveWeekStart = async (
  next: WeekStartDay,
  today: Date = new Date(),
  /** For a new install with no weeks yet: no transition week. */
  { immediately = false }: { immediately?: boolean } = {},
): Promise<WeekRule> => {
  const db = await openDatabase("userData.db");
  try {
    let saved: WeekRule = { weekStartsOn: next };
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (!immediately) {
        saved = changeWeekStart(await readWeekRule(txn), next, today);
      }
      for (const [key, value] of Object.entries(weekRuleToSettings(saved))) {
        await txn.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          [key, value],
        );
      }
    });
    return saved;
  } finally {
    await db.closeAsync();
  }
};
