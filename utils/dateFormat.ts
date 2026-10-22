import { DEVICE_LOCALE } from "./numberFormat";

// Dates on screen follow the device region, like numbers (see DEVICE_LOCALE).
// date-fns `format` with name tokens (EEE, MMM, a) is English-only without a
// locale, so it is kept for day keys ("yyyy-MM-dd") and not for display.

/** "Mon, Oct 3" / "Mo., 3. Okt." */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(DEVICE_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Monday, October 3" / "Montag, 3. Oktober" */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(DEVICE_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "2:05 PM" / "14:05", in the region's 12- or 24-hour clock. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString(DEVICE_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "10/03/2026, 2:05 PM" / "03.10.2026, 14:05" */
export function formatDateTime(date: Date): string {
  return date.toLocaleString(DEVICE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Month and day names for the region, for react-native-calendars. */
export function calendarLocaleNames(
  locale: string | undefined = DEVICE_LOCALE,
) {
  const months = Array.from({ length: 12 }, (_, m) => new Date(2024, m, 1));
  // 2024-01-07 is a Sunday; the calendars want Sunday first.
  const days = Array.from({ length: 7 }, (_, d) => new Date(2024, 0, 7 + d));
  const name = (date: Date, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString(locale, options);
  return {
    monthNames: months.map((m) => name(m, { month: "long" })),
    monthNamesShort: months.map((m) => name(m, { month: "short" })),
    dayNames: days.map((d) => name(d, { weekday: "long" })),
    dayNamesShort: days.map((d) => name(d, { weekday: "short" })),
  };
}
