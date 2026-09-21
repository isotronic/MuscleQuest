import { differenceInCalendarDays } from "date-fns";
import type {
  BodyMetricDefinition,
  BodyMeasurementSession,
} from "@/utils/database";
import type { ValueKind } from "@/utils/measurementConversions";

/** A headline metric goes stale once its last entry is this many days old. */
export const STALE_AFTER_DAYS = 7;

export interface QuickLogSummary {
  /** The metric shown on the card, or null when no metric is active. */
  metric: BodyMetricDefinition | null;
  /** Most recent entry for `metric`, or null if it has never been logged. */
  latest: {
    displayValue: number;
    displayUnit: string;
    recordedAt: Date;
  } | null;
  /** Calendar days since `latest`, or null when there is no entry. */
  daysSinceLastLog: number | null;
  /** Whether the headline needs a nudge: overdue, or never logged at all. */
  isStale: boolean;
  /** Whether any measurement of any metric exists, for the empty state. */
  hasAnyHistory: boolean;
}

function parseDbDate(recorded_at: string): Date {
  return new Date(
    recorded_at.includes("T") ? recorded_at : recorded_at.replace(" ", "T"),
  );
}

/**
 * Body weight is the metric people log most often, so it headlines the card
 * whenever it is active. Otherwise the user's first metric stands in.
 */
function pickHeadlineMetric(
  metrics: BodyMetricDefinition[],
): BodyMetricDefinition | null {
  const active = metrics.filter((m) => m.is_active && !m.is_deleted);
  if (active.length === 0) return null;
  return (
    active.find((m) => m.key === "weight") ??
    active.reduce((best, m) => (m.sort_order < best.sort_order ? m : best))
  );
}

export function selectQuickLogSummary(
  metrics: BodyMetricDefinition[] | undefined,
  sessions: BodyMeasurementSession[] | undefined,
  now: Date,
): QuickLogSummary {
  const metric = pickHeadlineMetric(metrics ?? []);
  const allSessions = sessions ?? [];
  const hasAnyHistory = allSessions.length > 0;

  if (!metric) {
    return {
      metric: null,
      latest: null,
      daysSinceLastLog: null,
      isStale: false,
      hasAnyHistory,
    };
  }

  // Sessions arrive newest-first, but sort defensively so the card never
  // shows an older reading than the one the user just entered.
  const withHeadline = allSessions
    .map((s) => ({
      recordedAt: parseDbDate(s.entry.recorded_at),
      value: s.values.find((v) => v.metric.id === metric.id),
    }))
    .filter((s) => s.value !== undefined)
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

  const mostRecent = withHeadline[0];
  if (!mostRecent) {
    return {
      metric,
      latest: null,
      daysSinceLastLog: null,
      // Never logged, but the user clearly tracks something: nudge them.
      isStale: hasAnyHistory,
      hasAnyHistory,
    };
  }

  const daysSinceLastLog = differenceInCalendarDays(now, mostRecent.recordedAt);

  return {
    metric,
    latest: {
      displayValue: mostRecent.value!.displayValue,
      displayUnit: mostRecent.value!.displayUnit,
      recordedAt: mostRecent.recordedAt,
    },
    daysSinceLastLog,
    isStale: daysSinceLastLog >= STALE_AFTER_DAYS,
    hasAnyHistory,
  };
}

/**
 * Seeds the log form with each metric's most recent reading, so logging an
 * unchanged measurement is a single tap.
 */
export function buildPrefillValues(
  metrics: BodyMetricDefinition[],
  sessions: BodyMeasurementSession[],
): Record<number, string> {
  const newestFirst = [...sessions].sort(
    (a, b) =>
      parseDbDate(b.entry.recorded_at).getTime() -
      parseDbDate(a.entry.recorded_at).getTime(),
  );

  const prefill: Record<number, string> = {};
  for (const metric of metrics) {
    const latest = newestFirst
      .flatMap((s) => s.values)
      .find((v) => v.metric.id === metric.id);
    prefill[metric.id] =
      latest !== undefined ? String(latest.displayValue) : "";
  }
  return prefill;
}

export interface MeasurementInputValue {
  metric_id: number;
  value_kind: ValueKind;
  displayValue: number;
}

/**
 * Turns the sheet's raw text inputs into values the insert mutation accepts,
 * dropping anything the user left blank or typed badly.
 */
export function buildMeasurementValues(
  metrics: BodyMetricDefinition[],
  inputValues: Record<number, string>,
): MeasurementInputValue[] {
  return metrics
    .map((m) => ({
      metric_id: m.id,
      value_kind: m.value_kind,
      displayValue: parseFloat((inputValues[m.id] ?? "").replace(",", ".")),
    }))
    .filter((v) => !isNaN(v.displayValue) && v.displayValue >= 0);
}
