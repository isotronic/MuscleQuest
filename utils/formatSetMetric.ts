import { t, plural } from "@lingui/core/macro";
import { formatNumber } from "./numberFormat";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return t`${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const oneDecimal = (value: number) => formatNumber(value, 1);

/**
 * One-line summary of a set for history lists. `weight` and `distance` must
 * already be in display units; `distanceUnit` only labels the value.
 */
export function formatSetMetric(
  set: {
    weight?: number | null;
    reps?: number | null;
    time?: number | null;
    distance?: number | null;
  },
  trackingType: string | null,
  weightUnit: string = "kg",
  bodyWeight: number = 0,
  distanceUnit: string = "m",
): string {
  switch (trackingType) {
    case "reps": {
      const reps = set.reps ?? 0;
      return plural(reps, { one: "# rep", other: "# reps" });
    }
    case "time":
      return formatDuration(set.time ?? 0);
    case "distance":
      return `${oneDecimal(set.distance ?? 0)} ${distanceUnit}`;
    case "assisted": {
      const assistValue = set.weight ?? 0;
      const assist = oneDecimal(assistValue);
      const resist = oneDecimal(Math.max(0, bodyWeight - assistValue));
      const reps = set.reps ?? 0;
      return t`${assist} ${weightUnit} assist / ${resist} ${weightUnit} resist × ${reps}`;
    }
    case "weight":
    default:
      return `${oneDecimal(set.weight ?? 0)} ${weightUnit} × ${set.reps ?? 0}`;
  }
}
