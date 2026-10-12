import { getCalendars, getLocales } from "expo-localization";

/** First-run setting values taken from the device's region. */
export interface LocaleDefaults {
  weightUnit: "kg" | "lbs";
  distanceUnit: "m" | "ft";
  sizeUnit: "cm" | "in";
  /** In the weight unit, like the weightIncrement setting. */
  weightIncrement: string;
  /** "1" Monday or "0" Sunday, as the weekStartsOn setting stores it. */
  weekStartsOn: "0" | "1";
}

// Regions that weigh in pounds even when the locale reports no system.
const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

export const DEFAULT_INCREMENT = { kg: "2.5", lbs: "5" } as const;

/**
 * Defaults for a new install. Only weeks starting on Sunday or Monday are
 * supported; any other first weekday (Saturday in parts of the Middle East)
 * falls back to Monday.
 */
export function localeDefaults(): LocaleDefaults {
  const locale = getLocales()[0];
  const imperial =
    locale?.measurementSystem === "us" ||
    (!!locale?.regionCode && IMPERIAL_REGIONS.has(locale.regionCode));
  const firstWeekday = getCalendars()[0]?.firstWeekday;
  return {
    weightUnit: imperial ? "lbs" : "kg",
    distanceUnit: imperial ? "ft" : "m",
    sizeUnit: imperial ? "in" : "cm",
    weightIncrement: imperial ? DEFAULT_INCREMENT.lbs : DEFAULT_INCREMENT.kg,
    // expo-localization counts Sunday as 1 (Weekday.SUNDAY), Monday as 2.
    weekStartsOn: firstWeekday === 1 ? "0" : "1",
  };
}
