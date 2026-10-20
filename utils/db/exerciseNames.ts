// Library exercise names in the device language.
//
// The stored name stays English: sharing, exports, imports and the search
// aliases depend on it. Queries that feed screens swap in the translated name
// through withDisplayName and keep the English one as english_name. The
// translations ship in the library file (exercise_translations), keyed by the
// library's exercise_id, which userData rows keep as app_exercise_id. Custom
// exercises have no translation and always show as typed.
//
// Loaded once at startup, before anything renders. Until then, and in tests,
// every name shows in English.
import Bugsnag from "@bugsnag/expo";
import type { AppLocale } from "@/utils/appLocale";
import { APP_DATA_DB } from "./appDataFile";
import { openDatabase } from "./connection";

/** "false" shows library exercise names in English. */
export const TRANSLATE_EXERCISE_NAMES_KEY = "translateExerciseNames";

let locale: AppLocale = "en";
let names = new Map<number, string>();
let translated = true;
let collator: Intl.Collator | null = null;

/**
 * Reads the translations for `deviceLocale` and the user's choice. A failure
 * leaves names in English rather than failing startup.
 */
export async function loadExerciseNames(
  deviceLocale: AppLocale,
): Promise<void> {
  locale = deviceLocale;
  collator = null;
  names = new Map();
  if (deviceLocale === "en") return;

  const userDb = await openDatabase("userData.db");
  try {
    const setting = await userDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [TRANSLATE_EXERCISE_NAMES_KEY],
    );
    translated = setting?.value !== "false";
  } finally {
    await userDb.closeAsync();
  }

  const appDb = await openDatabase(APP_DATA_DB);
  try {
    const rows = await appDb.getAllAsync<{ exercise_id: number; name: string }>(
      "SELECT exercise_id, name FROM exercise_translations WHERE locale = ?",
      [deviceLocale],
    );
    names = new Map(rows.map((row) => [row.exercise_id, row.name]));
    Bugsnag.leaveBreadcrumb("Exercise names loaded", {
      locale: deviceLocale,
      count: names.size,
      translated,
    });
  } finally {
    await appDb.closeAsync();
  }
}

/** Whether this device has translated names to switch between. */
export const hasExerciseNameTranslations = (): boolean => names.size > 0;

export const exerciseNamesTranslated = (): boolean => translated;

/** Applies the setting at once; callers refetch the queries showing names. */
export function setExerciseNamesTranslated(value: boolean): void {
  translated = value;
}

/** The name to show for a library (or custom) exercise. */
export function displayExerciseName(
  name: string,
  appExerciseId: number | null | undefined,
): string {
  if (!translated || appExerciseId == null) return name;
  return names.get(appExerciseId) ?? name;
}

/**
 * The row with its display name in `name` and the stored English name in
 * `english_name`, for search and the exercise screens' subtitle.
 */
export function withDisplayName<
  T extends { name: string; app_exercise_id?: number | null },
>(row: T): T & { english_name: string } {
  return {
    ...row,
    name: displayExerciseName(row.name, row.app_exercise_id),
    english_name: row.name,
  };
}

/** Orders display names alphabetically for the device language. */
export function compareExerciseNames(a: string, b: string): number {
  // Hermes ships Intl.Collator; the fallback only guards an engine without it.
  if (typeof Intl === "undefined" || !Intl.Collator) {
    return a.localeCompare(b);
  }
  collator ??= new Intl.Collator(locale, {
    sensitivity: "base",
    numeric: true,
  });
  return collator.compare(a, b);
}

/** Whether a screen should show the English name under the translated one. */
export const showsEnglishName = (row: {
  name: string;
  english_name?: string;
}): boolean => !!row.english_name && row.english_name !== row.name;

/** The row with its `exercise_name` swapped for the display name. */
export function withDisplayExerciseName<
  T extends { exercise_name: string | null; app_exercise_id?: number | null },
>(row: T): T {
  return row.exercise_name == null
    ? row
    : {
        ...row,
        exercise_name: displayExerciseName(
          row.exercise_name,
          row.app_exercise_id,
        ),
      };
}
