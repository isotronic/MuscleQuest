// The JS twin of progressionMetricSql: the per-set number personal records
// are judged by. Keep the two in step; prMetric.test.ts checks they agree.

export interface MetricSet {
  weight?: number | null;
  reps?: number | null;
  time?: number | null;
  distance?: number | null;
}

/**
 * Estimated 1RM (Epley) for weight and assisted sets, else reps, seconds or
 * metres. Paired-weight exercises always count both weights. Assisted sets
 * count body weight minus the assistance, so `bodyWeight` must be in the same
 * unit as `weight` (kg for stored values). Unknown tracking types score as
 * weight, like the SQL.
 */
export function setMetric(
  set: MetricSet,
  trackingType: string | null | undefined,
  {
    doubleWeight = false,
    bodyWeight = 0,
  }: { doubleWeight?: boolean; bodyWeight?: number } = {},
): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;
  switch (trackingType) {
    case "assisted":
      return (bodyWeight - weight) * (1 + reps / 30);
    case "reps":
      return reps;
    case "time":
      return set.time ?? 0;
    case "distance":
      return set.distance ?? 0;
    default:
      return weight * (doubleWeight ? 2 : 1) * (1 + reps / 30);
  }
}
