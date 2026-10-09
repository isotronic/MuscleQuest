import { metresToDisplay } from "./units";
import { formatNumber } from "./numberFormat";

/** A plan set's target distance (stored in metres) in the display unit. */
export function planDistanceToDisplay(
  metres: number,
  distanceUnit: string,
): number {
  return Math.round(metresToDisplay(metres, distanceUnit) * 100) / 100;
}

/**
 * The span of target distances across a plan exercise's sets, in the display
 * unit and without the unit label: "400" or "400 - 800". Undefined when no
 * set has a target.
 */
export function planDistanceRange(
  sets: { distance?: number | null }[],
  distanceUnit: string,
): string | undefined {
  const targets = sets
    .map((set) => set.distance)
    .filter((d): d is number => d != null)
    .map((d) => planDistanceToDisplay(d, distanceUnit));
  if (targets.length === 0) return undefined;
  const min = Math.min(...targets);
  const max = Math.max(...targets);
  return min === max
    ? formatNumber(min, 2)
    : `${formatNumber(min, 2)} - ${formatNumber(max, 2)}`;
}
