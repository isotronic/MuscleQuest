import { differenceInCalendarDays } from "date-fns";
import type {
  BodyMetricDefinition,
  LatestBodyMetricValue,
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
  latestValues: LatestBodyMetricValue[] | undefined,
  now: Date,
): QuickLogSummary {
  const metric = pickHeadlineMetric(metrics ?? []);
  const allLatest = latestValues ?? [];
  // One row per metric that has ever been logged, so a non-empty list means
  // the user has some measurement history.
  const hasAnyHistory = allLatest.length > 0;

  if (!metric) {
    return {
      metric: null,
      latest: null,
      daysSinceLastLog: null,
      isStale: false,
      hasAnyHistory,
    };
  }

  const mostRecent = allLatest.find((v) => v.metric.id === metric.id);
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

  const recordedAt = parseDbDate(mostRecent.recorded_at);
  const daysSinceLastLog = differenceInCalendarDays(now, recordedAt);

  return {
    metric,
    latest: {
      displayValue: mostRecent.displayValue,
      displayUnit: mostRecent.displayUnit,
      recordedAt,
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
  latestValues: LatestBodyMetricValue[],
): Record<number, string> {
  const prefill: Record<number, string> = {};
  for (const metric of metrics) {
    const latest = latestValues.find((v) => v.metric.id === metric.id);
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
 * Digits with an optional single decimal separator. Deliberately stricter than
 * parseFloat, which happily reads "8o" as 8 and would persist a wrong number.
 * No sign is accepted: a negative measurement is never meaningful.
 */
const MEASUREMENT_PATTERN = /^\d*(?:[.,]\d*)?$/;

/**
 * The single validation rule for a typed measurement, shared by the form (to
 * decide what to flag and whether submission is allowed) and by
 * `buildMeasurementValues` (to decide what gets persisted).
 *
 * Returns null for anything blank or malformed.
 */
export function parseMeasurementInput(text: string): number | null {
  const trimmed = (text ?? "").trim();
  if (!MEASUREMENT_PATTERN.test(trimmed)) return null;
  // The pattern alone accepts "" and ".", so require at least one digit.
  if (!/\d/.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Whether the user has typed something in this field that cannot be logged. */
export function isInvalidMeasurementInput(text: string): boolean {
  return text.trim() !== "" && parseMeasurementInput(text) === null;
}

/**
 * Turns the sheet's raw text inputs into values the insert mutation accepts,
 * dropping anything the user left blank or typed badly.
 */
export function buildMeasurementValues(
  metrics: BodyMetricDefinition[],
  inputValues: Record<number, string>,
): MeasurementInputValue[] {
  const values: MeasurementInputValue[] = [];
  for (const m of metrics) {
    const displayValue = parseMeasurementInput(inputValues[m.id] ?? "");
    if (displayValue === null) continue;
    values.push({
      metric_id: m.id,
      value_kind: m.value_kind,
      displayValue,
    });
  }
  return values;
}
