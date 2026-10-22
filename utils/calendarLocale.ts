import { LocaleConfig } from "react-native-calendars";
import { calendarLocaleNames } from "./dateFormat";

/**
 * react-native-calendars shows English month and day names unless a locale
 * is registered. Import this module (for its effect) where a calendar renders.
 */
LocaleConfig.locales.device = calendarLocaleNames();
LocaleConfig.defaultLocale = "device";
