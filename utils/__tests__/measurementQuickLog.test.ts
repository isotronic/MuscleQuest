import {
  selectQuickLogSummary,
  buildMeasurementValues,
  buildPrefillValues,
} from "../measurementQuickLog";
import type { BodyMetricDefinition, BodyMeasurementSession } from "../database";

const metric = (
  over: Partial<BodyMetricDefinition> & { id: number; key: string },
): BodyMetricDefinition => ({
  label: over.key,
  value_kind: "length",
  is_builtin: true,
  is_active: true,
  is_deleted: false,
  sort_order: 0,
  ...over,
});

const WEIGHT = metric({
  id: 1,
  key: "weight",
  label: "Body Weight",
  value_kind: "mass",
  sort_order: 0,
});
const WAIST = metric({ id: 2, key: "waist", label: "Waist", sort_order: 2 });
const CHEST = metric({ id: 3, key: "chest", label: "Chest", sort_order: 4 });

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Builds the naive local-time string SQLite hands back. Fixtures must be
 * local, not UTC: "logged yesterday" is a local-calendar question, so a UTC
 * fixture would make these tests pass or fail depending on the machine.
 */
const localStamp = (day: number, hour: number, minute = 0) =>
  `2026-09-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;

const session = (
  recorded_at: string,
  values: { metric: BodyMetricDefinition; displayValue: number }[],
): BodyMeasurementSession => ({
  entry: { id: Math.random(), recorded_at },
  values: values.map((v) => ({
    metric: v.metric,
    canonicalValue: v.displayValue,
    displayValue: v.displayValue,
    displayUnit: v.metric.value_kind === "mass" ? "kg" : "cm",
  })),
});

const NOW = new Date(2026, 8, 21, 10, 0, 0);

describe("selectQuickLogSummary", () => {
  it("headlines body weight when it is an active metric", () => {
    const summary = selectQuickLogSummary(
      [WAIST, WEIGHT, CHEST],
      [session(localStamp(21, 8), [{ metric: WEIGHT, displayValue: 82.5 }])],
      NOW,
    );

    expect(summary.metric?.key).toBe("weight");
    expect(summary.latest?.displayValue).toBe(82.5);
    expect(summary.latest?.displayUnit).toBe("kg");
  });

  it("falls back to the lowest sort_order metric when weight is inactive", () => {
    const summary = selectQuickLogSummary(
      [CHEST, WAIST],
      [session(localStamp(21, 8), [{ metric: WAIST, displayValue: 81 }])],
      NOW,
    );

    expect(summary.metric?.key).toBe("waist");
    expect(summary.latest?.displayValue).toBe(81);
  });

  it("skips past sessions that omit the headline metric", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT, WAIST],
      [
        session(localStamp(20, 8), [{ metric: WAIST, displayValue: 80 }]),
        session(localStamp(14, 8), [{ metric: WEIGHT, displayValue: 83.1 }]),
      ],
      NOW,
    );

    expect(summary.latest?.displayValue).toBe(83.1);
    expect(summary.daysSinceLastLog).toBe(7);
  });

  it("reports no history when nothing has ever been logged", () => {
    const summary = selectQuickLogSummary([WEIGHT], [], NOW);

    expect(summary.hasAnyHistory).toBe(false);
    expect(summary.latest).toBeNull();
    expect(summary.daysSinceLastLog).toBeNull();
  });

  it("counts calendar days, so late yesterday reads as one day ago", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT],
      [session(localStamp(20, 23, 30), [{ metric: WEIGHT, displayValue: 82 }])],
      NOW,
    );

    expect(summary.daysSinceLastLog).toBe(1);
  });

  it("marks the headline stale once it is seven days old", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT],
      [session(localStamp(14, 8), [{ metric: WEIGHT, displayValue: 82 }])],
      NOW,
    );

    expect(summary.isStale).toBe(true);
  });

  it("does not mark the headline stale at six days old", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT],
      [session(localStamp(15, 8), [{ metric: WEIGHT, displayValue: 82 }])],
      NOW,
    );

    expect(summary.isStale).toBe(false);
  });

  it("marks stale when other metrics were logged but the headline never was", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT, WAIST],
      [session(localStamp(21, 8), [{ metric: WAIST, displayValue: 80 }])],
      NOW,
    );

    expect(summary.hasAnyHistory).toBe(true);
    expect(summary.latest).toBeNull();
    expect(summary.isStale).toBe(true);
  });

  it("returns no metric when the user has disabled every metric", () => {
    const summary = selectQuickLogSummary([], [], NOW);

    expect(summary.metric).toBeNull();
  });

  it("treats undefined inputs as still loading rather than as empty", () => {
    const summary = selectQuickLogSummary(undefined, undefined, NOW);

    expect(summary.metric).toBeNull();
    expect(summary.hasAnyHistory).toBe(false);
  });
});

describe("buildMeasurementValues", () => {
  it("converts typed text into values tagged with each metric's kind", () => {
    const values = buildMeasurementValues([WEIGHT, WAIST], {
      [WEIGHT.id]: "82.5",
      [WAIST.id]: "81",
    });

    expect(values).toEqual([
      { metric_id: 1, value_kind: "mass", displayValue: 82.5 },
      { metric_id: 2, value_kind: "length", displayValue: 81 },
    ]);
  });

  it("accepts a comma decimal separator", () => {
    const values = buildMeasurementValues([WEIGHT], { [WEIGHT.id]: "82,5" });

    expect(values[0].displayValue).toBe(82.5);
  });

  it("drops blank and unparseable entries", () => {
    const values = buildMeasurementValues([WEIGHT, WAIST, CHEST], {
      [WEIGHT.id]: "82.5",
      [WAIST.id]: "   ",
      [CHEST.id]: "abc",
    });

    expect(values).toHaveLength(1);
    expect(values[0].metric_id).toBe(1);
  });

  it("drops negative values, which are never valid measurements", () => {
    const values = buildMeasurementValues([WEIGHT], { [WEIGHT.id]: "-5" });

    expect(values).toHaveLength(0);
  });
});

describe("buildPrefillValues", () => {
  it("seeds each metric from its own most recent reading", () => {
    const prefill = buildPrefillValues(
      [WEIGHT, WAIST],
      [
        session(localStamp(21, 8), [{ metric: WEIGHT, displayValue: 82.5 }]),
        session(localStamp(14, 8), [{ metric: WAIST, displayValue: 81 }]),
      ],
    );

    expect(prefill).toEqual({ 1: "82.5", 2: "81" });
  });

  it("leaves a metric blank when it has never been logged", () => {
    const prefill = buildPrefillValues(
      [WEIGHT, WAIST],
      [session(localStamp(21, 8), [{ metric: WEIGHT, displayValue: 82.5 }])],
    );

    expect(prefill[WAIST.id]).toBe("");
  });

  it("prefers the newest reading when a metric was logged repeatedly", () => {
    const prefill = buildPrefillValues(
      [WEIGHT],
      [
        session(localStamp(14, 8), [{ metric: WEIGHT, displayValue: 84 }]),
        session(localStamp(21, 8), [{ metric: WEIGHT, displayValue: 82.5 }]),
      ],
    );

    expect(prefill[WEIGHT.id]).toBe("82.5");
  });

  it("handles a user with no history at all", () => {
    expect(buildPrefillValues([WEIGHT], [])).toEqual({ 1: "" });
  });
});
