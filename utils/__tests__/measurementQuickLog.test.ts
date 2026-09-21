import {
  selectQuickLogSummary,
  buildMeasurementValues,
  buildPrefillValues,
  parseMeasurementInput,
} from "../measurementQuickLog";
import type { BodyMetricDefinition, LatestBodyMetricValue } from "../database";

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

const latest = (
  metric: BodyMetricDefinition,
  displayValue: number,
  recorded_at: string,
): LatestBodyMetricValue => ({
  metric,
  canonicalValue: displayValue,
  displayValue,
  displayUnit: metric.value_kind === "mass" ? "kg" : "cm",
  recorded_at,
});

const NOW = new Date(2026, 8, 21, 10, 0, 0);

describe("selectQuickLogSummary", () => {
  it("headlines body weight when it is an active metric", () => {
    const summary = selectQuickLogSummary(
      [WAIST, WEIGHT, CHEST],
      [latest(WEIGHT, 82.5, localStamp(21, 8))],
      NOW,
    );

    expect(summary.metric?.key).toBe("weight");
    expect(summary.latest?.displayValue).toBe(82.5);
    expect(summary.latest?.displayUnit).toBe("kg");
  });

  it("falls back to the lowest sort_order metric when weight is inactive", () => {
    const summary = selectQuickLogSummary(
      [CHEST, WAIST],
      [latest(WAIST, 81, localStamp(21, 8))],
      NOW,
    );

    expect(summary.metric?.key).toBe("waist");
    expect(summary.latest?.displayValue).toBe(81);
  });

  it("picks out the headline metric among other metrics' readings", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT, WAIST],
      [
        latest(WAIST, 80, localStamp(20, 8)),
        latest(WEIGHT, 83.1, localStamp(14, 8)),
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
      [latest(WEIGHT, 82, localStamp(20, 23, 30))],
      NOW,
    );

    expect(summary.daysSinceLastLog).toBe(1);
  });

  it("marks the headline stale once it is seven days old", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT],
      [latest(WEIGHT, 82, localStamp(14, 8))],
      NOW,
    );

    expect(summary.isStale).toBe(true);
  });

  it("does not mark the headline stale at six days old", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT],
      [latest(WEIGHT, 82, localStamp(15, 8))],
      NOW,
    );

    expect(summary.isStale).toBe(false);
  });

  it("marks stale when other metrics were logged but the headline never was", () => {
    const summary = selectQuickLogSummary(
      [WEIGHT, WAIST],
      [latest(WAIST, 80, localStamp(21, 8))],
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

describe("parseMeasurementInput", () => {
  it.each([
    ["82.5", 82.5],
    ["82,5", 82.5],
    ["82", 82],
    ["0", 0],
    ["82.", 82],
    [".5", 0.5],
    ["  82.5  ", 82.5],
  ])("parses %p as %p", (input, expected) => {
    expect(parseMeasurementInput(input as string)).toBe(expected);
  });

  it.each([[""], ["   "], ["abc"], ["."], ["-5"], ["1e3"], ["82 5"]])(
    "rejects %p",
    (input) => {
      expect(parseMeasurementInput(input as string)).toBeNull();
    },
  );

  // parseFloat would silently return 8 here, quietly logging the wrong number.
  it.each([["8o"], ["82.5abc"], ["12kg"]])(
    "rejects %p rather than truncating it",
    (input) => {
      expect(parseMeasurementInput(input as string)).toBeNull();
    },
  );
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

  it("drops malformed text instead of truncating it to a number", () => {
    const values = buildMeasurementValues([WEIGHT, WAIST], {
      [WEIGHT.id]: "8o",
      [WAIST.id]: "80",
    });

    expect(values).toEqual([
      { metric_id: 2, value_kind: "length", displayValue: 80 },
    ]);
  });
});

describe("buildPrefillValues", () => {
  it("seeds each metric from its own most recent reading", () => {
    const prefill = buildPrefillValues(
      [WEIGHT, WAIST],
      [
        latest(WEIGHT, 82.5, localStamp(21, 8)),
        latest(WAIST, 81, localStamp(14, 8)),
      ],
    );

    expect(prefill).toEqual({ 1: "82.5", 2: "81" });
  });

  it("leaves a metric blank when it has never been logged", () => {
    const prefill = buildPrefillValues(
      [WEIGHT, WAIST],
      [latest(WEIGHT, 82.5, localStamp(21, 8))],
    );

    expect(prefill[WAIST.id]).toBe("");
  });

  it("seeds a rarely-logged metric even when it is long out of date", () => {
    const prefill = buildPrefillValues(
      [WEIGHT, WAIST],
      [
        latest(WEIGHT, 82.5, localStamp(21, 8)),
        // Logged months ago; a "last N sessions" query would have lost this.
        latest(WAIST, 81, "2026-01-04T08:00:00"),
      ],
    );

    expect(prefill[WAIST.id]).toBe("81");
  });

  it("handles a user with no history at all", () => {
    expect(buildPrefillValues([WEIGHT], [])).toEqual({ 1: "" });
  });
});
