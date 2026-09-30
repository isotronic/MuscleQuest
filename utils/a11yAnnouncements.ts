import { plural, t } from "@lingui/core/macro";

/** Countdown points, in seconds, at which a screen reader hears the rest left. */
const REST_THRESHOLDS = [30, 10];

function formatRest(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Spoken after a set is logged, e.g. "Set 2 complete. Rest 1:30." */
export function setCompleteAnnouncement(
  setNumber: number,
  restSeconds: number | null,
): string {
  if (!restSeconds || restSeconds <= 0) {
    return t`Set ${setNumber} complete.`;
  }
  const rest = formatRest(restSeconds);
  return t`Set ${setNumber} complete. Rest ${rest}.`;
}

/**
 * What to announce as the rest countdown ticks from `previous` to `current`
 * seconds, or null to stay quiet. Speaking every second would drown out
 * everything else, so only the thresholds and the end are announced. An
 * adjustment that jumps past a threshold reports the real time left.
 */
export function restCountdownAnnouncement(
  previous: number | null,
  current: number,
): string | null {
  if (previous === null || current >= previous) return null;
  if (current <= 0) return t`Rest over`;
  const crossed = REST_THRESHOLDS.some(
    (threshold) => previous > threshold && current <= threshold,
  );
  if (!crossed) return null;
  return plural(current, {
    one: "# second of rest left",
    other: "# seconds of rest left",
  });
}
