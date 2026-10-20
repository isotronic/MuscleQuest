import Fuse, { type IFuseOptions } from "fuse.js";
import { Platform } from "react-native";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { hasExerciseNameTranslations } from "@/utils/db/exerciseNames";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** The settings sub-screens, in the order the root lists them. */
export const SETTINGS_SCREENS = [
  { id: "profile", title: msg`Profile and account`, icon: "account" },
  { id: "units", title: msg`Units`, icon: "ruler" },
  { id: "workout", title: msg`Workout and rest timer`, icon: "timer" },
  { id: "progression", title: msg`Progression`, icon: "trending-up" },
  { id: "stats", title: msg`Stats`, icon: "chart-bar" },
  { id: "reminders", title: msg`Reminders and notifications`, icon: "bell" },
  { id: "data", title: msg`Data and backup`, icon: "cloud-upload" },
  { id: "appearance", title: msg`Appearance`, icon: "palette" },
  { id: "about", title: msg`About`, icon: "information" },
] as const satisfies readonly {
  id: string;
  title: MessageDescriptor;
  icon: IconName;
}[];

export type SettingsScreenId = (typeof SETTINGS_SCREENS)[number]["id"];

/**
 * Every settings row, for the search on the settings root. `keywords` are
 * other words someone might type for the row, translated with the title.
 */
export const SETTINGS_INDEX = [
  // Profile and account
  {
    id: "account",
    screen: "profile",
    title: msg`Sign in with Google`,
    keywords: msg`account, log in, sign out, Google`,
  },
  {
    id: "weeklyGoal",
    screen: "profile",
    title: msg`Weekly goal`,
    keywords: msg`days per week, target, streak`,
  },
  {
    id: "weekStartsOn",
    screen: "profile",
    title: msg`Week starts on`,
    keywords: msg`Monday, Sunday, first day, calendar`,
  },
  {
    id: "bodyWeight",
    screen: "profile",
    title: msg`Body weight`,
    keywords: msg`weigh, assisted, bodyweight`,
  },
  {
    id: "privacy",
    screen: "profile",
    title: msg`Privacy`,
    keywords: msg`friends, sharing, profile, visible`,
  },
  {
    id: "deleteAccount",
    screen: "profile",
    title: msg`Delete account`,
    keywords: msg`remove, erase, close account`,
  },
  // Units
  {
    id: "weightUnit",
    screen: "units",
    title: msg`Weight unit`,
    keywords: msg`kg, lbs, pounds, kilograms`,
  },
  {
    id: "distanceUnit",
    screen: "units",
    title: msg`Distance unit`,
    keywords: msg`metres, feet, m, ft`,
  },
  {
    id: "sizeUnit",
    screen: "units",
    title: msg`Size unit`,
    keywords: msg`cm, inches, measurements`,
  },
  // Workout and rest timer
  {
    id: "weightIncrement",
    screen: "workout",
    title: msg`Weight steps`,
    keywords: msg`increment, plus, minus, weight increment`,
  },
  {
    id: "defaultSets",
    screen: "workout",
    title: msg`Default sets`,
    keywords: msg`sets, new exercise`,
  },
  {
    id: "defaultRestTime",
    screen: "workout",
    title: msg`Default rest time`,
    keywords: msg`rest, break, timer, pause`,
  },
  {
    id: "restTimerIncrement",
    screen: "workout",
    title: msg`Rest timer increment`,
    keywords: msg`rest, timer, seconds`,
  },
  {
    id: "restTimerVibration",
    screen: "workout",
    title: msg`Vibrate after rest`,
    keywords: msg`vibration, rest, timer`,
  },
  {
    id: "restTimerSound",
    screen: "workout",
    title: msg`Play sound after rest`,
    keywords: msg`sound, alarm, rest, timer`,
  },
  {
    id: "exactRestAlerts",
    screen: "workout",
    title: msg`Rest alerts on time`,
    keywords: msg`exact, alarms, reminders, late, delayed, notification, rest`,
  },
  {
    id: "restAlertOnSilent",
    screen: "workout",
    title: msg`Rest alert sounds on silent`,
    keywords: msg`silent, alarm, volume, mute, rest, notification`,
  },
  {
    id: "restTimerNotification",
    screen: "workout",
    title: msg`Show rest notification while app is open`,
    keywords: msg`notification, rest, timer`,
  },
  {
    id: "timerCountdown",
    screen: "workout",
    title: msg`Exercise timer countdown`,
    keywords: msg`timer, countdown, timed exercise`,
  },
  {
    id: "timerCountdownSound",
    screen: "workout",
    title: msg`Play countdown beeps (Exercise Timer)`,
    keywords: msg`beeps, sound, timer`,
  },
  {
    id: "timerGoalSound",
    screen: "workout",
    title: msg`Play goal achieved sound (Exercise Timer)`,
    keywords: msg`sound, timer, goal`,
  },
  {
    id: "keepScreenOn",
    screen: "workout",
    title: msg`Keep screen on during workout`,
    keywords: msg`screen, display, awake`,
  },
  {
    id: "buttonSize",
    screen: "workout",
    title: msg`Button size during workout`,
    keywords: msg`large buttons, size`,
  },
  {
    id: "loggingStyle",
    screen: "workout",
    title: msg`Logging style`,
    keywords: msg`list, one set at a time, all sets`,
  },
  {
    id: "alwaysUseGlobalHistory",
    screen: "workout",
    title: msg`Always use most recent exercise history`,
    keywords: msg`history, previous, last time`,
  },
  {
    id: "plates",
    screen: "workout",
    title: msg`Plates`,
    keywords: msg`plate calculator, barbell, bar`,
  },
  // Progression
  {
    id: "adaptiveProgression",
    screen: "progression",
    title: msg`Suggest load and rep adjustments`,
    keywords: msg`adaptive progression, suggestions, progress`,
  },
  {
    id: "progressionIncrements",
    screen: "progression",
    title: msg`Load increments`,
    keywords: msg`barbell, dumbbell, cable, machine, increment`,
  },
  {
    id: "excludeDeload",
    screen: "progression",
    title: msg`Exclude deload workouts from exercise stats`,
    keywords: msg`deload, stats`,
  },
  // Stats
  {
    id: "excludeWarmupSets",
    screen: "stats",
    title: msg`Exclude warmup sets from stats`,
    keywords: msg`warmup, warm-up, volume`,
  },
  {
    id: "countUnilateralDouble",
    screen: "stats",
    title: msg`Single-side rep logging`,
    keywords: msg`unilateral, one side, reps, volume`,
  },
  {
    id: "doubleWeightForPaired",
    screen: "stats",
    title: msg`Per-side weight entry`,
    keywords: msg`dumbbell, cable, both sides, volume`,
  },
  {
    id: "includeBodyWeightInVolume",
    screen: "stats",
    title: msg`Include body weight in volume`,
    keywords: msg`bodyweight, push-ups, pull-ups, volume`,
  },
  // Reminders and notifications
  {
    id: "workoutReminders",
    screen: "reminders",
    title: msg`Workout reminders`,
    keywords: msg`reminder, notification, days, time`,
  },
  // Data and backup
  {
    id: "backup",
    screen: "data",
    title: msg`Backup and restore`,
    keywords: msg`backup, restore, cloud, save`,
  },
  {
    id: "export",
    screen: "data",
    title: msg`Export training data`,
    keywords: msg`CSV, JSON, download, export`,
  },
  {
    id: "downloadImages",
    screen: "data",
    title: msg`Download all exercise animations`,
    keywords: msg`images, animations, offline, download`,
  },
  // Appearance
  {
    id: "showTips",
    screen: "appearance",
    title: msg`Show tips on home`,
    keywords: msg`tips, onboarding, introduction, home`,
  },
  {
    id: "translateExerciseNames",
    screen: "appearance",
    title: msg`Translate exercise names`,
    keywords: msg`language, English, exercise names, translation`,
  },
  // About
  {
    id: "featureRequests",
    screen: "about",
    title: msg`Request or vote for new features`,
    keywords: msg`feedback, ideas, vote`,
  },
  {
    id: "privacyPolicy",
    screen: "about",
    title: msg`Privacy policy`,
    keywords: msg`privacy, data, policy`,
  },
] as const satisfies readonly {
  id: string;
  screen: SettingsScreenId;
  title: MessageDescriptor;
  keywords: MessageDescriptor;
}[];

export type SettingId = (typeof SETTINGS_INDEX)[number]["id"];

/** What decides whether a row is on screen. */
export interface SettingsState {
  signedIn: boolean;
  progressionOn: boolean;
}

// Rows shown only in some states, and the row on the same screen that
// unlocks them: the search sends people there instead of to a missing row.
const UNLOCKED_BY: Partial<
  Record<SettingId, { when: keyof SettingsState; row: SettingId }>
> = {
  privacy: { when: "signedIn", row: "account" },
  deleteAccount: { when: "signedIn", row: "account" },
  progressionIncrements: { when: "progressionOn", row: "adaptiveProgression" },
  excludeDeload: { when: "progressionOn", row: "adaptiveProgression" },
};

/** The row a search result should open and highlight in this state. */
export function settingTarget(id: SettingId, state: SettingsState): SettingId {
  const lock = UNLOCKED_BY[id];
  return lock && !state[lock.when] ? lock.row : id;
}

// Rows the settings screens render on Android only.
const ANDROID_ONLY: readonly SettingId[] = [
  "exactRestAlerts",
  "restAlertOnSilent",
];

/** Whether the settings screens render this row on this device. */
const isShown = (id: SettingId): boolean =>
  (Platform.OS === "android" || !ANDROID_ONLY.includes(id)) &&
  // Only where the device language has translated exercise names.
  (id !== "translateExerciseNames" || hasExerciseNameTranslations());

/** An index entry with its text translated for the current locale. */
export interface SettingsSearchDoc {
  id: SettingId;
  screen: SettingsScreenId;
  title: string;
  keywords: string;
  screenTitle: string;
}

/** The index in the current locale; `translate` is Lingui's `_`. */
export function translateSettingsIndex(
  translate: (descriptor: MessageDescriptor) => string,
): SettingsSearchDoc[] {
  const screenTitles = new Map<string, string>(
    SETTINGS_SCREENS.map((s) => [s.id, translate(s.title)]),
  );
  return SETTINGS_INDEX.filter((entry) => isShown(entry.id)).map((entry) => ({
    id: entry.id,
    screen: entry.screen,
    title: translate(entry.title),
    keywords: translate(entry.keywords),
    screenTitle: screenTitles.get(entry.screen) ?? "",
  }));
}

// The help search's options (utils/helpSearch.ts), so typos are forgiven the
// same way in both.
const fuseOptions: IFuseOptions<SettingsSearchDoc> = {
  keys: [
    { name: "title", weight: 2 },
    { name: "keywords", weight: 1 },
    { name: "screenTitle", weight: 0.5 },
  ],
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
};

export function buildSettingsSearch(docs: SettingsSearchDoc[]) {
  return new Fuse(docs, fuseOptions);
}

/** Matching rows, best first; nothing for an empty query. */
export function searchSettings(
  index: Fuse<SettingsSearchDoc>,
  query: string,
): SettingsSearchDoc[] {
  if (!query.trim()) return [];
  return index.search(query.trim()).map((result) => result.item);
}
