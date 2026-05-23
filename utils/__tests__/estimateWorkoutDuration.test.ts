import {
  computeWorkoutDurationEstimate,
  formatDurationEstimate,
  EQUIPMENT_DURATION_DEFAULTS,
  DEFAULT_FALLBACK_DURATION,
  MAX_VALID_SET_DURATION_SEC,
  SUFFICIENT_HISTORY_MIN,
  SPARSE_HISTORY_MIN,
  REP_NORM,
  type SetDurationSample,
} from "@/utils/estimateWorkoutDuration";
import type { UserExercise, Set } from "@/store/workoutStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSet(overrides: Partial<Set> = {}): Set {
  return {
    repsMin: REP_NORM,
    repsMax: REP_NORM,
    restMinutes: 0,
    restSeconds: 0,
    time: undefined,
    ...overrides,
  };
}

function makeExercise(
  id: number,
  equipment: string,
  sets: Set[],
  tracking_type = "weight",
): UserExercise {
  return {
    exercise_id: id,
    app_exercise_id: undefined,
    name: `Exercise ${id}`,
    image: [],
    local_animated_uri: "",
    animated_url: "",
    equipment,
    body_part: "chest",
    target_muscle: "pectorals",
    secondary_muscles: [],
    description: "",
    tracking_type,
    sets,
  } as UserExercise;
}

// Wrap raw duration numbers as legacy (no-reps) history samples.
function raw(duration: number): SetDurationSample {
  return { duration, reps: null };
}

// Wrap duration numbers as rep-aware history samples.
function withReps(duration: number, reps: number): SetDurationSample {
  return { duration, reps };
}

// ─── computeWorkoutDurationEstimate ──────────────────────────────────────────

describe("computeWorkoutDurationEstimate", () => {
  describe("edge cases", () => {
    it("returns zeros when there are no exercises", () => {
      expect(computeWorkoutDurationEstimate([], {})).toEqual({
        minSeconds: 0,
        maxSeconds: 0,
      });
    });

    it("returns zeros when exercises have no sets", () => {
      const ex = makeExercise(1, "barbell", []);
      expect(computeWorkoutDurationEstimate([ex], {})).toEqual({
        minSeconds: 0,
        maxSeconds: 0,
      });
    });
  });

  describe("timed sets", () => {
    it("uses planned time as fallback when there is no history", () => {
      const set = makeSet({ time: 30, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "barbell", [set], "time");
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(30);
      expect(result.maxSeconds).toBe(30);
    });

    it("adds rest to timed sets when a set follows", () => {
      // Rest is only added when there is a subsequent set — not after the last set.
      const setWithRest = makeSet({
        time: 45,
        restMinutes: 1,
        restSeconds: 30,
      });
      const setNoRest = makeSet({ time: 20, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "cable", [setWithRest, setNoRest], "time");
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(45 + 90 + 20); // first set + its rest + second set
      expect(result.maxSeconds).toBe(45 + 90 + 20);
    });

    it("prefers historical data over planned time when sufficient history exists", () => {
      // History consistently faster than planned time
      const uniformHistory = [20, 20, 20, 20, 20].map(raw);
      const set = makeSet({ time: 60, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "cable", [set], "time");
      const result = computeWorkoutDurationEstimate([ex], {
        1: uniformHistory,
      });
      // P25 = P75 = 20, not 60
      expect(result.minSeconds).toBe(20);
      expect(result.maxSeconds).toBe(20);
    });

    it("blends history and planned time when history is sparse", () => {
      // 1 history sample of 40 s, planned time 60 s
      // Expected mid ≈ (40 * 0.5 + 60 * 0.5) = 50, halfSpread = 0 (planned time has no spread)
      const set = makeSet({ time: 60, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "cable", [set], "time");
      const result = computeWorkoutDurationEstimate([ex], { 1: [raw(40)] });
      expect(result.minSeconds).toBe(50);
      expect(result.maxSeconds).toBe(50);
    });
  });

  describe("equipment defaults (no history)", () => {
    it("uses barbell default when no history exists", () => {
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
      const set = makeSet({ restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "barbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], {});
      // makeSet uses REP_NORM reps, so scale = 1.0 — values unchanged
      expect(result.minSeconds).toBe(defMin);
      expect(result.maxSeconds).toBe(defMax);
    });

    it("uses the generic fallback for unknown equipment", () => {
      const [defMin, defMax] = DEFAULT_FALLBACK_DURATION;
      const set = makeSet();
      const ex = makeExercise(1, "some weird machine", [set]);
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(defMin);
      expect(result.maxSeconds).toBe(defMax);
    });

    it("uses the generic fallback for empty equipment string", () => {
      const [defMin, defMax] = DEFAULT_FALLBACK_DURATION;
      const set = makeSet();
      const ex = makeExercise(1, "", [set]);
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(defMin);
      expect(result.maxSeconds).toBe(defMax);
    });

    it("adds rest to equipment-default estimate when a set follows", () => {
      // Rest is only added when there is a subsequent set — not after the last set.
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["dumbbell"];
      const rest = 90; // 1 min 30 sec
      const setWithRest = makeSet({ restMinutes: 1, restSeconds: 30 });
      const setNoRest = makeSet({ restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "dumbbell", [setWithRest, setNoRest]);
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(defMin + rest + defMin);
      expect(result.maxSeconds).toBe(defMax + rest + defMax);
    });
  });

  describe("rest time handling", () => {
    it("adds zero rest when restMinutes and restSeconds are both 0", () => {
      const set = makeSet({ time: 30, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "cable", [set], "time");
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(30);
    });

    it("correctly combines minutes and seconds for rest when a set follows", () => {
      const setWithRest = makeSet({
        time: 20,
        restMinutes: 2,
        restSeconds: 15,
      });
      const setNoRest = makeSet({ time: 10, restMinutes: 0, restSeconds: 0 });
      const ex = makeExercise(1, "cable", [setWithRest, setNoRest], "time");
      const result = computeWorkoutDurationEstimate([ex], {});
      expect(result.minSeconds).toBe(20 + 2 * 60 + 15 + 10);
    });
  });

  describe("warmup sets included", () => {
    it("counts warmup sets the same as working sets", () => {
      const warmupSet = makeSet({
        isWarmup: true,
        restMinutes: 0,
        restSeconds: 0,
      });
      const workingSet = makeSet({
        isWarmup: false,
        restMinutes: 0,
        restSeconds: 0,
      });
      const ex = makeExercise(1, "barbell", [warmupSet, workingSet]);
      const exWorking = makeExercise(2, "barbell", [workingSet]);
      const r1 = computeWorkoutDurationEstimate([ex], {});
      const r2 = computeWorkoutDurationEstimate([exWorking], {});
      // warmup exercise has 2 sets, working-only has 1 — warmup should be larger
      expect(r1.minSeconds).toBeGreaterThan(r2.minSeconds);
    });
  });

  describe("outlier and invalid duration filtering", () => {
    it("ignores set durations above MAX_VALID_SET_DURATION_SEC", () => {
      const validHistory = [40, 42, 44, 46, 48].map(raw);
      const dirtyHistory = [40, 42, 44, 46, MAX_VALID_SET_DURATION_SEC + 1].map(
        raw,
      );
      const set = makeSet();
      const ex1 = makeExercise(1, "barbell", [set]);
      const ex2 = makeExercise(2, "barbell", [set]);
      const r1 = computeWorkoutDurationEstimate([ex1], { 1: validHistory });
      const r2 = computeWorkoutDurationEstimate([ex2], { 2: dirtyHistory });
      // The outlier sample should push r2's estimate toward equipment default
      // Both should at least be valid positive numbers
      expect(r1.minSeconds).toBeGreaterThan(0);
      expect(r2.minSeconds).toBeGreaterThan(0);
    });

    it("falls back to equipment default when all history entries are invalid (zero)", () => {
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["cable"];
      const set = makeSet();
      const ex = makeExercise(1, "cable", [set]);
      const result = computeWorkoutDurationEstimate([ex], {
        1: [0, 0, 0, 0, 0].map(raw),
      });
      expect(result.minSeconds).toBe(defMin);
      expect(result.maxSeconds).toBe(defMax);
    });

    it("falls back when all history entries exceed the outlier cutoff", () => {
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
      const set = makeSet();
      const ex = makeExercise(1, "barbell", [set]);
      const oversized = Array(5)
        .fill(MAX_VALID_SET_DURATION_SEC + 100)
        .map(raw);
      const result = computeWorkoutDurationEstimate([ex], { 1: oversized });
      expect(result.minSeconds).toBe(defMin);
      expect(result.maxSeconds).toBe(defMax);
    });
  });

  describe("sparse history blending (1–2 samples)", () => {
    it("produces a result between history mean and equipment range with 1 sample", () => {
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["dumbbell"];
      const histValue = 60; // above equipment default
      const set = makeSet();
      const ex = makeExercise(1, "dumbbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], {
        1: [raw(histValue)],
      });
      // With 1 sample: mid = histMean*0.5 + defMid*0.5, spread narrowed
      expect(result.minSeconds).toBeGreaterThanOrEqual(defMin - 5);
      expect(result.maxSeconds).toBeLessThanOrEqual(histValue + 20);
      expect(result.minSeconds).toBeLessThan(result.maxSeconds);
    });

    it("produces a result between history mean and equipment range with 2 samples", () => {
      const set = makeSet();
      const ex = makeExercise(1, "dumbbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], {
        1: [raw(50), raw(70)],
      });
      expect(result.minSeconds).toBeGreaterThan(0);
      expect(result.maxSeconds).toBeGreaterThanOrEqual(result.minSeconds);
    });
  });

  describe("moderate history blending (3–4 samples)", () => {
    it("blends 70/30 with 3 samples", () => {
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["cable"];
      const history = [30, 32, 34].map(raw); // 3 samples, all lower than default
      const set = makeSet();
      const ex = makeExercise(1, "cable", [set]);
      const result = computeWorkoutDurationEstimate([ex], { 1: history });
      const histMean = (30 + 32 + 34) / 3;
      const defMid = (defMin + defMax) / 2;
      const expectedMid = histMean * 0.7 + defMid * 0.3;
      // Result mid should be close to expectedMid
      const resultMid = (result.minSeconds + result.maxSeconds) / 2;
      expect(Math.abs(resultMid - expectedMid)).toBeLessThan(5);
    });

    it("blends with 4 samples", () => {
      const set = makeSet();
      const ex = makeExercise(1, "barbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], {
        1: [40, 45, 50, 55].map(raw),
      });
      expect(result.minSeconds).toBeGreaterThan(0);
      expect(result.maxSeconds).toBeGreaterThanOrEqual(result.minSeconds);
    });
  });

  describe("sufficient history (≥5 samples)", () => {
    it("returns P25/P75 range from sorted history", () => {
      // Uniform history: P25 = P75 = 40
      const uniform = [40, 40, 40, 40, 40].map(raw);
      const set = makeSet();
      const ex = makeExercise(1, "barbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], { 1: uniform });
      expect(result.minSeconds).toBe(40);
      expect(result.maxSeconds).toBe(40);
    });

    it("returns spread P25/P75 for varied history", () => {
      // Values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      const history = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(raw);
      const set = makeSet();
      const ex = makeExercise(1, "barbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], { 1: history });
      // P25 of [10..100] ≈ 32.5, P75 ≈ 77.5 (rounded)
      expect(result.minSeconds).toBeLessThan(result.maxSeconds);
      expect(result.minSeconds).toBeGreaterThanOrEqual(30);
      expect(result.maxSeconds).toBeLessThanOrEqual(80);
    });

    it("caps samples at MAX_HISTORY_SAMPLES (uses newest)", () => {
      // Pass 25 samples — only the first 20 (newest) should be used
      const newestSamples = Array(20).fill(40).map(raw);
      const oldSamples = Array(5).fill(200).map(raw); // these would be filtered as outliers anyway, but placed at end (oldest)
      const history = [...newestSamples, ...oldSamples];
      const set = makeSet();
      const ex = makeExercise(1, "barbell", [set]);
      const result = computeWorkoutDurationEstimate([ex], { 1: history });
      // Newest 20 samples are all 40 → P25 = P75 = 40
      expect(result.minSeconds).toBe(40);
      expect(result.maxSeconds).toBe(40);
    });
  });

  describe("supersets", () => {
    it("skips rest for the first exercise in a superset pair", () => {
      const rest = 90;
      const setA = makeSet({ restMinutes: 1, restSeconds: 30 }); // 90 s rest — should be ignored
      const setB = makeSet({ restMinutes: 1, restSeconds: 30 }); // 90 s rest — should be kept
      const exA: UserExercise = {
        ...makeExercise(1, "barbell", [setA]),
        supersetGroupId: "ss1",
      };
      const exB: UserExercise = {
        ...makeExercise(2, "dumbbell", [setB]),
        supersetGroupId: "ss1",
      };

      const result = computeWorkoutDurationEstimate([exA, exB], {});
      const resultWithoutSuperset = computeWorkoutDurationEstimate(
        [
          makeExercise(1, "barbell", [setA]),
          makeExercise(2, "dumbbell", [setB]),
        ],
        {},
      );

      // Superset result should be exactly `rest` seconds less (one rest skipped)
      expect(result.minSeconds).toBe(resultWithoutSuperset.minSeconds - rest);
      expect(result.maxSeconds).toBe(resultWithoutSuperset.maxSeconds - rest);
    });

    it("keeps rest for the second exercise in a superset pair", () => {
      const setA = makeSet({ restMinutes: 1, restSeconds: 0 });
      const setB = makeSet({ restMinutes: 2, restSeconds: 0 }); // 120 s rest
      const setC = makeSet({ restMinutes: 0, restSeconds: 0 });
      const exA: UserExercise = {
        ...makeExercise(1, "barbell", [setA]),
        supersetGroupId: "ss1",
      };
      const exB: UserExercise = {
        ...makeExercise(2, "barbell", [setB]),
        supersetGroupId: "ss1",
      };
      // A trailing exercise forces exB's rest to be counted (it has a next slot).
      const exC = makeExercise(3, "cable", [setC]);
      const [bbMin, bbMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
      const [cableMin, cableMax] = EQUIPMENT_DURATION_DEFAULTS["cable"];

      const result = computeWorkoutDurationEstimate([exA, exB, exC], {});
      // work A + 0 rest (superset first, rest skipped) + work B + 120 rest + work C + 0 rest (last)
      expect(result.minSeconds).toBe(bbMin + 0 + bbMin + 120 + cableMin);
      expect(result.maxSeconds).toBe(bbMax + 0 + bbMax + 120 + cableMax);
    });

    it("non-superset exercises are unaffected", () => {
      const set = makeSet({ restMinutes: 1, restSeconds: 0 });
      const solo = makeExercise(3, "cable", [set]);
      const exA: UserExercise = {
        ...makeExercise(1, "barbell", [set]),
        supersetGroupId: "ss1",
      };
      const exB: UserExercise = {
        ...makeExercise(2, "barbell", [set]),
        supersetGroupId: "ss1",
      };

      const result = computeWorkoutDurationEstimate([exA, exB, solo], {});
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
      const [cableMin, cableMax] = EQUIPMENT_DURATION_DEFAULTS["cable"];

      // solo exercise is last, so its rest is not added
      expect(result.minSeconds).toBe(defMin + 0 + defMin + 60 + cableMin);
      expect(result.maxSeconds).toBe(defMax + 0 + defMax + 60 + cableMax);
    });
  });

  describe("multiple exercises", () => {
    it("sums estimates across all exercises", () => {
      const set = makeSet({ restMinutes: 0, restSeconds: 0 });
      const ex1 = makeExercise(1, "barbell", [set]);
      const ex2 = makeExercise(2, "dumbbell", [set]);
      const combined = computeWorkoutDurationEstimate([ex1, ex2], {});
      const r1 = computeWorkoutDurationEstimate([ex1], {});
      const r2 = computeWorkoutDurationEstimate([ex2], {});
      expect(combined.minSeconds).toBe(r1.minSeconds + r2.minSeconds);
      expect(combined.maxSeconds).toBe(r1.maxSeconds + r2.maxSeconds);
    });

    it("respects each exercise's own history independently", () => {
      const set = makeSet({ restMinutes: 0, restSeconds: 0 });
      const ex1 = makeExercise(1, "barbell", [set]);
      const ex2 = makeExercise(2, "barbell", [set]);
      // ex1 has fast history, ex2 uses default
      const result = computeWorkoutDurationEstimate([ex1, ex2], {
        1: [30, 30, 30, 30, 30].map(raw), // 5 fast samples → P25=P75=30
      });
      const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
      expect(result.minSeconds).toBe(30 + defMin);
      expect(result.maxSeconds).toBe(30 + defMax);
    });
  });

  // ─── Rep-aware estimation ────────────────────────────────────────────────────

  describe("rep-aware estimation", () => {
    describe("no history — equipment defaults scale with rep count", () => {
      it("produces a shorter estimate for fewer reps than REP_NORM", () => {
        const halfReps = makeSet({ repsMin: 5, repsMax: 5 });
        const normReps = makeSet({ repsMin: REP_NORM, repsMax: REP_NORM });
        const ex1 = makeExercise(1, "barbell", [halfReps]);
        const ex2 = makeExercise(2, "barbell", [normReps]);
        const r1 = computeWorkoutDurationEstimate([ex1], {});
        const r2 = computeWorkoutDurationEstimate([ex2], {});
        expect(r1.minSeconds).toBeLessThan(r2.minSeconds);
        expect(r1.maxSeconds).toBeLessThan(r2.maxSeconds);
      });

      it("produces a longer estimate for more reps than REP_NORM", () => {
        const moreReps = makeSet({ repsMin: 15, repsMax: 15 });
        const normReps = makeSet({ repsMin: REP_NORM, repsMax: REP_NORM });
        const ex1 = makeExercise(1, "dumbbell", [moreReps]);
        const ex2 = makeExercise(2, "dumbbell", [normReps]);
        const r1 = computeWorkoutDurationEstimate([ex1], {});
        const r2 = computeWorkoutDurationEstimate([ex2], {});
        expect(r1.minSeconds).toBeGreaterThan(r2.minSeconds);
        expect(r1.maxSeconds).toBeGreaterThan(r2.maxSeconds);
      });

      it("scales proportionally: 5 reps ≈ half of 10 reps estimate", () => {
        const [rawMin, rawMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
        const set = makeSet({ repsMin: 5, repsMax: 5 });
        const ex = makeExercise(1, "barbell", [set]);
        const result = computeWorkoutDurationEstimate([ex], {});
        expect(result.minSeconds).toBe(Math.round(rawMin * (5 / REP_NORM)));
        expect(result.maxSeconds).toBe(Math.round(rawMax * (5 / REP_NORM)));
      });

      it("widens the range when repsMin < repsMax", () => {
        const wideRange = makeSet({ repsMin: 5, repsMax: 15 });
        const singleRep = makeSet({ repsMin: 10, repsMax: 10 });
        const ex1 = makeExercise(1, "barbell", [wideRange]);
        const ex2 = makeExercise(2, "barbell", [singleRep]);
        const r1 = computeWorkoutDurationEstimate([ex1], {});
        const r2 = computeWorkoutDurationEstimate([ex2], {});
        // Wide range: min uses 5 reps, max uses 15 reps → larger spread
        const spread1 = r1.maxSeconds - r1.minSeconds;
        const spread2 = r2.maxSeconds - r2.minSeconds;
        expect(spread1).toBeGreaterThan(spread2);
      });

      it("does not scale timed sets", () => {
        const timedSet = makeSet({
          time: 40,
          repsMin: 5,
          repsMax: 5,
          restMinutes: 0,
          restSeconds: 0,
        });
        const ex = makeExercise(1, "barbell", [timedSet], "time");
        const result = computeWorkoutDurationEstimate([ex], {});
        // set.time wins regardless of reps
        expect(result.minSeconds).toBe(40);
        expect(result.maxSeconds).toBe(40);
      });

      it("does not scale when reps are undefined", () => {
        const [defMin, defMax] = EQUIPMENT_DURATION_DEFAULTS["barbell"];
        const noRepsSet = makeSet({
          repsMin: undefined,
          repsMax: undefined,
          restMinutes: 0,
          restSeconds: 0,
        });
        const ex = makeExercise(1, "barbell", [noRepsSet]);
        const result = computeWorkoutDurationEstimate([ex], {});
        expect(result.minSeconds).toBe(defMin);
        expect(result.maxSeconds).toBe(defMax);
      });
    });

    describe("rep-aware history — per-rep pace used for estimation", () => {
      it("estimates lower for fewer reps than historical average", () => {
        // History: 5 sets of 15 reps, each taking 45 s → 3 s/rep
        const history = Array(5)
          .fill(null)
          .map(() => withReps(45, 15));
        const set = makeSet({ repsMin: 5, repsMax: 5 });
        const ex = makeExercise(1, "barbell", [set]);
        const result = computeWorkoutDurationEstimate([ex], { 1: history });
        // 3 s/rep × 5 reps = 15 s
        expect(result.minSeconds).toBe(15);
        expect(result.maxSeconds).toBe(15);
      });

      it("estimates higher for more reps than historical average", () => {
        // History: 5 sets of 5 reps, each taking 20 s → 4 s/rep
        const history = Array(5)
          .fill(null)
          .map(() => withReps(20, 5));
        const set = makeSet({ repsMin: 15, repsMax: 15 });
        const ex = makeExercise(1, "dumbbell", [set]);
        const result = computeWorkoutDurationEstimate([ex], { 1: history });
        // 4 s/rep × 15 reps = 60 s
        expect(result.minSeconds).toBe(60);
        expect(result.maxSeconds).toBe(60);
      });

      it("min/max range reflects repsMin vs repsMax", () => {
        // Uniform history: 5 s/rep
        const history = Array(5)
          .fill(null)
          .map(() => withReps(50, 10));
        const set = makeSet({ repsMin: 8, repsMax: 12 });
        const ex = makeExercise(1, "barbell", [set]);
        const result = computeWorkoutDurationEstimate([ex], { 1: history });
        // min = 5 * 8 = 40, max = 5 * 12 = 60
        expect(result.minSeconds).toBe(40);
        expect(result.maxSeconds).toBe(60);
      });

      it("falls back gracefully when all history has null reps", () => {
        // Legacy history without rep counts — should use raw-duration path
        const history = [40, 40, 40, 40, 40].map(raw);
        const set = makeSet({ repsMin: 8, repsMax: 12 });
        const ex = makeExercise(1, "barbell", [set]);
        const result = computeWorkoutDurationEstimate([ex], { 1: history });
        // Raw P25/P75 from uniform history = 40
        expect(result.minSeconds).toBe(40);
        expect(result.maxSeconds).toBe(40);
      });

      it("blends sparse rep-aware history (1–2 samples) with defaults", () => {
        // 1 rep-aware sample: 30 s at 10 reps → 3 s/rep
        const history = [withReps(30, REP_NORM)];
        const set = makeSet({ repsMin: REP_NORM, repsMax: REP_NORM });
        const [rawMin, rawMax] = EQUIPMENT_DURATION_DEFAULTS["cable"];
        const ex = makeExercise(1, "cable", [set]);
        const result = computeWorkoutDurationEstimate([ex], { 1: history });
        // Blended result should be between history and equipment default
        expect(result.minSeconds).toBeGreaterThan(0);
        expect(result.maxSeconds).toBeGreaterThan(0);
        expect(result.minSeconds).toBeLessThanOrEqual(
          Math.max(rawMin, 30) + 10,
        );
      });
    });
  });
});

// ─── formatDurationEstimate ───────────────────────────────────────────────────

describe("formatDurationEstimate", () => {
  it("shows a range for different min and max (under 1 hour)", () => {
    const result = formatDurationEstimate({
      minSeconds: 42 * 60,
      maxSeconds: 50 * 60,
    });
    expect(result).toBe("42 min – 50 min");
  });

  it("deduplicates equal bounds (shows single value)", () => {
    const result = formatDurationEstimate({
      minSeconds: 45 * 60,
      maxSeconds: 45 * 60,
    });
    expect(result).toBe("45 min");
  });

  it("rounds up to the nearest minute", () => {
    // 44 min 30 sec → ceil = 45 min
    const result = formatDurationEstimate({
      minSeconds: 44 * 60 + 30,
      maxSeconds: 44 * 60 + 30,
    });
    expect(result).toBe("45 min");
  });

  it("formats exactly 60 minutes as 1h", () => {
    const result = formatDurationEstimate({
      minSeconds: 3600,
      maxSeconds: 3600,
    });
    expect(result).toBe("1h");
  });

  it("formats 1h 5min correctly", () => {
    const result = formatDurationEstimate({
      minSeconds: 3600 + 5 * 60,
      maxSeconds: 3600 + 5 * 60,
    });
    expect(result).toBe("1h 5min");
  });

  it("handles ranges that straddle the 1-hour mark", () => {
    const result = formatDurationEstimate({
      minSeconds: 55 * 60,
      maxSeconds: 65 * 60,
    });
    expect(result).toBe("55 min – 1h 5min");
  });

  it("formats multi-hour workouts", () => {
    const result = formatDurationEstimate({
      minSeconds: 90 * 60,
      maxSeconds: 100 * 60,
    });
    expect(result).toBe("1h 30min – 1h 40min");
  });
});
