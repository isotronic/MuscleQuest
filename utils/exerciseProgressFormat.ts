import { t, plural } from "@lingui/core/macro";
import { formatSetMetric } from "./formatSetMetric";
import { formatNumber } from "./numberFormat";
import { planDistanceToDisplay } from "./planDistance";
import { formatWeight, kgToDisplay, metresToDisplay } from "./units";
import { formatFromTotalSeconds } from "./utility";

const formatDistance = (metres: number, distanceUnit: string) =>
  `${formatNumber(planDistanceToDisplay(metres, distanceUnit), 2)} ${distanceUnit}`;

/**
 * A progression metric (estimated 1RM in kg, reps, seconds or metres, by
 * tracking type) in the user's units.
 */
export function formatProgressMetric(
  value: number | null,
  trackingType: string | null,
  weightUnit: string,
  distanceUnit: string,
): string {
  if (value == null) return "—";
  switch (trackingType) {
    case "reps":
      return plural(Math.round(value), { one: "# rep", other: "# reps" });
    case "time":
      return formatFromTotalSeconds(Math.round(value));
    case "distance":
      return formatDistance(value, distanceUnit);
    default:
      return `${formatWeight(value, weightUnit)} ${weightUnit}`;
  }
}

/** One canonical set (kg, metres, seconds) as a line of text. */
export function formatProgressSet(
  set: {
    weight?: number | null;
    reps?: number | null;
    time?: number | null;
    distance?: number | null;
  },
  trackingType: string | null,
  weightUnit: string,
  distanceUnit: string,
): string {
  switch (trackingType) {
    case "reps":
      return set.reps != null
        ? plural(set.reps, { one: "# rep", other: "# reps" })
        : "—";
    case "time":
      return set.time != null ? formatFromTotalSeconds(set.time) : "—";
    case "distance":
      return set.distance != null
        ? formatDistance(set.distance, distanceUnit)
        : "—";
    default: {
      if (set.weight == null) return "—";
      const weight = formatWeight(set.weight, weightUnit);
      const reps = set.reps ?? 0;
      return trackingType === "assisted"
        ? t`${weight} ${weightUnit} assist × ${reps}`
        : `${weight} ${weightUnit} × ${reps}`;
    }
  }
}

/** "1RM 100 kg", for weight-based sets that have one. */
export function formatOneRepMax(
  oneRepMax: number | null | undefined,
  weightUnit: string,
): string | null {
  if (oneRepMax == null) return null;
  const e1rm = formatWeight(oneRepMax, weightUnit);
  return t`1RM ${e1rm} ${weightUnit}`;
}

/**
 * A history row's set as text. Weight and distance arrive canonical; the
 * assisted resist part uses the body weight logged at the time, falling back
 * to `currentBodyWeight` (already in the user's unit).
 */
export function formatHistorySet(
  set: {
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    hist_bw_kg: number | null;
  },
  trackingType: string | null,
  weightUnit: string,
  distanceUnit: string,
  currentBodyWeight: number,
): string {
  return formatSetMetric(
    {
      ...set,
      weight: set.weight != null ? kgToDisplay(set.weight, weightUnit) : null,
      distance:
        set.distance != null
          ? metresToDisplay(set.distance, distanceUnit)
          : null,
    },
    trackingType,
    weightUnit,
    set.hist_bw_kg != null
      ? kgToDisplay(set.hist_bw_kg, weightUnit)
      : currentBodyWeight,
    distanceUnit,
  );
}
