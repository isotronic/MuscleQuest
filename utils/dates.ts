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
