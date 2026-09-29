import { t } from "@lingui/core/macro";

/**
 * Text alternatives for the charts. A screen reader cannot read a plotted
 * line, so each chart is exposed as one element whose label says what the
 * chart shows: its subject, period and the shape of the data.
 */

/** Changes smaller than this share of the start value count as steady. */
const STEADY_THRESHOLD = 0.02;

/** Whole numbers stay whole; anything else is rounded to one decimal. */
function formatChartNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function withUnit(value: number, unit: string | undefined): string {
  const formatted = formatChartNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/** The TimeRangeSelector value, as words. */
export function timeRangePhrase(timeRange: string): string {
  switch (timeRange) {
    case "30":
      return t`last 30 days`;
    case "90":
      return t`last 90 days`;
    case "365":
      return t`last year`;
    default:
      return t`all time`;
  }
}

/**
 * For line charts: where the series starts and ends, and which way it went.
 * Null values are periods without data and are skipped.
 */
export function summarizeTrend({
  title,
  timeRange,
  values,
  unit,
}: {
  title: string;
  timeRange: string;
  values: (number | null)[];
  unit?: string;
}): string {
  const range = timeRangePhrase(timeRange);
  const points = values.filter((v): v is number => v !== null);
  if (points.length === 0) {
    return t`${title}, ${range}: no data in this period.`;
  }

  const last = withUnit(points[points.length - 1], unit);
  if (points.length === 1) {
    return t`${title}, ${range}: ${last}.`;
  }

  const firstValue = points[0];
  const lastValue = points[points.length - 1];
  // Unit only on the end value: "from 80 to 95 kg".
  const first = formatChartNumber(firstValue);
  const change =
    firstValue === 0 ? lastValue : (lastValue - firstValue) / firstValue;
  if (Math.abs(change) < STEADY_THRESHOLD) {
    return t`${title}, ${range}: from ${first} to ${last}, holding steady.`;
  }
  return change > 0
    ? t`${title}, ${range}: from ${first} to ${last}, trending up.`
    : t`${title}, ${range}: from ${first} to ${last}, trending down.`;
}

/** For bar charts: the total across the period and the busiest bucket. */
export function summarizeTotals({
  title,
  timeRange,
  buckets,
  unit,
  emptyText,
}: {
  title: string;
  timeRange: string;
  buckets: { label: string; value: number }[];
  unit?: string;
  emptyText: string;
}): string {
  const range = timeRangePhrase(timeRange);
  const total = buckets.reduce((sum, b) => sum + b.value, 0);
  if (total <= 0) {
    return t`${title}, ${range}: ${emptyText}.`;
  }
  const peak = buckets.reduce((best, b) => (b.value > best.value ? b : best));
  const totalText = withUnit(total, unit);
  const peakLabel = peak.label;
  const peakText = withUnit(peak.value, unit);
  return t`${title}, ${range}: ${totalText} in total, most in ${peakLabel} with ${peakText}.`;
}

/** For the pie chart: every slice with its share, largest first. */
export function summarizeShares({
  title,
  shares,
  emptyText,
}: {
  title: string;
  shares: { name: string; percent: number }[];
  emptyText: string;
}): string {
  if (shares.length === 0) {
    return t`${title}: ${emptyText}.`;
  }
  const list = [...shares]
    .sort((a, b) => b.percent - a.percent)
    .map((s) => `${s.name} ${formatChartNumber(s.percent)}%`)
    .join(", ");
  return t`${title}: ${list}.`;
}
