import { renderHook } from "@testing-library/react-native";
import { useStatsInsights } from "../useStatsInsights";
import { KG_PER_LB, roundCanonical } from "@/utils/units";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTrackedExercise = (
  name: string,
  trackingType: string,
  progressionMetrics: number[],
): any => ({
  name,
  tracking_type: trackingType,
  completed_sets: progressionMetrics.map((m) => ({ progressionMetric: m })),
});

// ---------------------------------------------------------------------------
// workoutsPerWeek
// ---------------------------------------------------------------------------

describe("workoutsPerWeek", () => {
  it("returns null while the workout count is unknown", () => {
    const { result } = renderHook(() =>
      useStatsInsights(undefined, [], {}, 7, "kg"),
    );
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("returns null when there are no workouts", () => {
    const { result } = renderHook(() => useStatsInsights(0, [], {}, 7, "kg"));
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("returns null when timeRangeDays is 0", () => {
    const { result } = renderHook(() => useStatsInsights(1, [], {}, 0, "kg"));
    expect(result.current.workoutsPerWeek).toBeNull();
  });

  it("calculates workouts per week correctly", () => {
    const { result } = renderHook(() => useStatsInsights(6, [], {}, 14, "kg"));
    expect(result.current.workoutsPerWeek).toBeCloseTo(3);
  });
});

// ---------------------------------------------------------------------------
// biggestGain (tracking type branches)
// ---------------------------------------------------------------------------

describe("biggestGain", () => {
  it("returns null when trackedExercises is undefined", () => {
    const { result } = renderHook(() =>
      useStatsInsights(0, undefined, {}, 7, "kg"),
    );
    expect(result.current.biggestGainLabel).toBeNull();
    expect(result.current.biggestGainValue).toBeNull();
  });

  it("returns null when exercise has fewer than 2 sets", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Bench", "weight", [100])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBeNull();
  });

  it("formats weight gain in kg", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Bench Press", "weight", [120, 100])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBe("Bench Press");
    expect(result.current.biggestGainValue).toBe("+20.0 kg");
  });

  it("converts weight gain to lbs", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Bench Press", "weight", [120, 100])],
        {},
        7,
        "lbs",
      ),
    );
    const numStr = result.current.biggestGainValue!.replace(/[^0-9.]/g, "");
    expect(parseFloat(numStr)).toBeCloseTo(20 / KG_PER_LB, 1);
  });

  it("does not report float noise between a legacy and a rounded row as a gain", () => {
    // 135 lbs saved before rounding, then the same lift saved rounded, which
    // lands a fraction of a gram heavier.
    const legacy = 135 * KG_PER_LB;
    const rounded = roundCanonical(legacy);
    expect(rounded).toBeGreaterThan(legacy);
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Bench Press", "weight", [rounded, legacy])],
        {},
        7,
        "lbs",
      ),
    );
    expect(result.current.biggestGainLabel).toBeNull();
    expect(result.current.biggestGainValue).toBeNull();
  });

  it("formats reps gain", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Pull-ups", "reps", [20, 15])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+5 reps");
  });

  it("formats time gain", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Plank", "time", [120, 90])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+30s");
  });

  it("formats distance gain with default distance unit", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Run", "distance", [5.5, 4.0])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainValue).toBe("+1.5 m");
  });

  it("returns null label/value when gain is negative", () => {
    const { result } = renderHook(() =>
      useStatsInsights(
        0,
        [makeTrackedExercise("Bench Press", "weight", [90, 100])],
        {},
        7,
        "kg",
      ),
    );
    expect(result.current.biggestGainLabel).toBeNull();
    expect(result.current.biggestGainValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// topBodyPart (normalization and warm-ups are covered by mergeBodyPartCounts
// and fetchBodyPartSetCounts)
// ---------------------------------------------------------------------------

describe("topBodyPart", () => {
  it("returns null while the counts are loading", () => {
    const { result } = renderHook(() =>
      useStatsInsights(0, [], undefined, 7, "kg"),
    );
    expect(result.current.topBodyPart).toBeNull();
  });

  it("returns null when no sets were counted", () => {
    const { result } = renderHook(() => useStatsInsights(0, [], {}, 7, "kg"));
    expect(result.current.topBodyPart).toBeNull();
  });

  it("returns the body part with the most sets", () => {
    const { result } = renderHook(() =>
      useStatsInsights(2, [], { back: 1, chest: 3, legs: 2 }, 7, "kg"),
    );
    expect(result.current.topBodyPart).toBe("chest");
  });
});
