/**
 * Single parsing and formatting authority for stored date values.
 *
 * Two different things are stored and they must not be confused:
 *
 * 1. **The instant** (`date_completed`, `recorded_at`): a UTC point in time,
 *    used for durations, ordering and displayed clock times.
 * 2. **The training day** (`local_date`): the device-local calendar date the
 *    workout happened on, used for streaks, the calendar, weekly goals and
 *    "worked out today". It is stored rather than derived so that it does not
 *    move if the user later travels or a DST rule changes.
 */

// Matches a trailing UTC designator or a numeric offset: Z, +10:00, -0800.
const HAS_OFFSET = /([zZ]|[+-]\d\d:?\d\d)$/;

/**
 * Parse a timestamp read from SQLite.
 *
 * `datetime('now')` and `CURRENT_TIMESTAMP` produce UTC values with no offset
 * (`YYYY-MM-DD HH:MM:SS`), and an ISO date-time without an offset is parsed as
 * *local* time by the JS engine. Appending `Z` when no offset is present is
 * what keeps those values from being shifted by the device offset.
 */
export function parseDbTimestamp(value: string): Date {
  // The column is nullable and older rows can be empty; an invalid Date is what
  // callers already handle, so never throw here.
  if (typeof value !== "string") return new Date(NaN);
  const trimmed = value.trim();
  if (HAS_OFFSET.test(trimmed)) return new Date(trimmed);
  // A bare "YYYY-MM-DD" is already parsed as UTC midnight by spec; anything
  // longer is a date-time that needs the explicit Z.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return new Date(trimmed);
  return new Date(trimmed.replace(" ", "T") + "Z");
}

/** The device-local calendar date of an instant, as "YYYY-MM-DD". */
export function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The pair of values a new row needs: the UTC instant and the training day. */
export function nowForDb(): { utc: string; localDate: string } {
  const now = new Date();
  return { utc: now.toISOString(), localDate: toLocalDateKey(now) };
}

/**
 * Whether a stored `local_date` falls within an inclusive range of local days.
 *
 * Both ends are compared as "YYYY-MM-DD" keys, so the time of day on the
 * boundary days is irrelevant: a workout finished at 23:45 on the last day of
 * the range is inside it.
 */
export function isLocalDateInRange(
  localDate: string,
  from: Date,
  to: Date,
): boolean {
  if (!localDate) return false;
  return localDate >= toLocalDateKey(from) && localDate <= toLocalDateKey(to);
}

/**
 * A stored `local_date` key as a Date at local midnight on that day.
 *
 * For formatting a training day. `new Date("2026-08-13")` would be UTC
 * midnight, which renders as the previous day anywhere west of UTC.
 */
export function localDateKeyToDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * The local date key `days` whole calendar days before today.
 *
 * The start bound for a "last N days" filter. SQLite's `date('now', '-N days')`
 * would count back from the UTC day instead.
 */
export function localDateKeyDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateKey(d);
}
