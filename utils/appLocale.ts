import { getLocales } from "expo-localization";

// The languages the app is translated into. Lingui-free, so the data layer
// can use it too.
export const APP_LOCALES = ["en", "de", "es", "fr"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

const isAppLocale = (code: string): code is AppLocale =>
  (APP_LOCALES as readonly string[]).includes(code);

/** The first device language the app is translated into, else English. */
export function preferredLocale(): AppLocale {
  for (const { languageCode } of getLocales()) {
    if (languageCode && isAppLocale(languageCode)) return languageCode;
  }
  return "en";
}
