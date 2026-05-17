function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
): string {
  switch (trackingType) {
    case "reps":
      return `${set.reps ?? 0} reps`;
    case "time":
      return formatDuration(set.time ?? 0);
    case "distance":
      return `${set.distance ?? 0} m`;
    case "assisted": {
      const assist = set.weight ?? 0;
      const resist = Math.max(0, bodyWeight - assist);
      return `${assist} ${weightUnit} assist / ${resist} ${weightUnit} resist × ${set.reps ?? 0}`;
    }
    case "weight":
    default:
      return `${set.weight ?? 0} ${weightUnit} × ${set.reps ?? 0}`;
  }
}
