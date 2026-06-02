import {
  computeLoadIncrement,
  computeReducedLoad,
  evaluateProgression,
} from "../progressionEngine";
import {
  ExerciseFeedbackPayload,
  ProgressionEngineInputs,
  UserProgressionIncrements,
} from "@/types/progression";
import { Set } from "@/store/workoutStore";

const DEFAULT_INCREMENTS: UserProgressionIncrements = {
  barbellKg: 2.5,
  dumbbellKg: 2.0,
  cableKg: 2.5,
  machineKg: 2.5,
};

const WORKING_SET: Set = {
  repsMin: 8,
  repsMax: 12,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
  isWarmup: false,
};

const NARROW_RANGE_SET: Set = {
  repsMin: 8,
  repsMax: 10,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
  isWarmup: false,
};

const FIXED_REP_SET: Set = {
  repsMin: 10,
  repsMax: 10,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
  isWarmup: false,
};

function makeFeedback(
  overrides: Partial<ExerciseFeedbackPayload> = {},
): ExerciseFeedbackPayload {
  return {
    userWorkoutExerciseId: 42,
    effortRating: "moderate",
    painFlag: "none",
    performanceRatio: 1.0,
    ...overrides,
  };
}

function makeInputs(
  overrides: Partial<ProgressionEngineInputs> = {},
): ProgressionEngineInputs {
  return {
    userWorkoutExerciseId: 42,
    exerciseId: 100,
    trackingType: "weight",
    equipment: "barbell",
    currentSets: [WORKING_SET],
    recentWorkingWeight: 100,
    latestFeedback: makeFeedback(),
    priorFeedbackHistory: [],
    recoveryRating: null,
    consecutiveDirectionCount: 1,
    userIncrements: DEFAULT_INCREMENTS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeLoadIncrement
// ---------------------------------------------------------------------------
describe("computeLoadIncrement", () => {
  it("returns barbellKg for barbell", () => {
    expect(computeLoadIncrement("barbell", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns barbellKg for ez barbell", () => {
    expect(computeLoadIncrement("ez barbell", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns barbellKg for trap bar", () => {
    expect(computeLoadIncrement("trap bar", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns dumbbellKg for dumbbell", () => {
    expect(computeLoadIncrement("dumbbell", DEFAULT_INCREMENTS)).toBe(2.0);
  });

  it("returns cableKg for cable", () => {
    expect(computeLoadIncrement("cable", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns cableKg for rope", () => {
    expect(computeLoadIncrement("rope", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns machineKg for leverage machine", () => {
    expect(computeLoadIncrement("leverage machine", DEFAULT_INCREMENTS)).toBe(
      2.5,
    );
  });

  it("returns machineKg for smith machine", () => {
    expect(computeLoadIncrement("smith machine", DEFAULT_INCREMENTS)).toBe(2.5);
  });

  it("returns 0 for body weight", () => {
    expect(computeLoadIncrement("body weight", DEFAULT_INCREMENTS)).toBe(0);
  });

  it("returns 0 for kettlebell", () => {
    expect(computeLoadIncrement("kettlebell", DEFAULT_INCREMENTS)).toBe(0);
  });

  it("respects custom increments", () => {
    const custom: UserProgressionIncrements = {
      barbellKg: 5,
      dumbbellKg: 1,
      cableKg: 2.5,
      machineKg: 10,
    };
    expect(computeLoadIncrement("barbell", custom)).toBe(5);
    expect(computeLoadIncrement("dumbbell", custom)).toBe(1);
    expect(computeLoadIncrement("leverage machine", custom)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// computeReducedLoad
// ---------------------------------------------------------------------------
describe("computeReducedLoad", () => {
  it("reduces 100 kg by 5% to 95 kg", () => {
    expect(computeReducedLoad(100)).toBe(95);
  });

  it("rounds down to nearest 0.5 kg", () => {
    // 5% of 101 = 5.05, so 101 - 5.05 = 95.95, floor to 95.5
    expect(computeReducedLoad(101)).toBe(95.5);
  });

  it("ensures at least 0.5 kg reduction for small weights", () => {
    // 5% of 5 kg = 0.25 kg, which is less than 0.5; result must be <= 4.5
    expect(computeReducedLoad(5)).toBeLessThanOrEqual(4.5);
  });

  it("returns 0 for 0 input", () => {
    expect(computeReducedLoad(0)).toBe(0);
  });

  it("handles 20 kg correctly", () => {
    // 5% of 20 = 1 kg reduction, result = 19 kg
    expect(computeReducedLoad(20)).toBe(19);
  });

  it("result is always less than input by at least 0.5", () => {
    [10, 20, 50, 80, 100, 120].forEach((w) => {
      expect(computeReducedLoad(w)).toBeLessThanOrEqual(w - 0.5);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — safety rules
// ---------------------------------------------------------------------------
describe("evaluateProgression — safety rules", () => {
  it("PAIN_BLOCK: holds on first pain report", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          painFlag: "pain",
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("PAIN_BLOCK");
  });

  it("PAIN_LOAD: reduces load on second consecutive pain report", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          painFlag: "pain",
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 2,
        recentWorkingWeight: 100,
      }),
    );
    expect(result.action).toBe("reduce_load");
    expect(result.ruleKey).toBe("PAIN_LOAD");
    expect(result.suggestedWeight).toBe(95);
  });

  it("PAIN_BLOCK: holds for reps-only even on second consecutive pain", () => {
    const result = evaluateProgression(
      makeInputs({
        trackingType: "reps",
        latestFeedback: makeFeedback({ painFlag: "pain" }),
        recentWorkingWeight: null,
        consecutiveDirectionCount: 2,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("PAIN_BLOCK");
  });

  it("FAILED_FIRST_SIGNAL: holds on first failed session", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "failed",
          performanceRatio: 0.7,
        }),
        recentWorkingWeight: 100,
        consecutiveDirectionCount: 1,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("FAILED_FIRST_SIGNAL");
  });

  it("FAILED_SETS: reduces load on second consecutive failed session", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "failed",
          performanceRatio: 0.7,
        }),
        recentWorkingWeight: 100,
        consecutiveDirectionCount: 2,
      }),
    );
    expect(result.action).toBe("reduce_load");
    expect(result.ruleKey).toBe("FAILED_SETS");
    expect(result.suggestedWeight).toBe(95);
  });

  it("FAILED_SETS: holds for reps-only tracking type (no weight to reduce)", () => {
    const result = evaluateProgression(
      makeInputs({
        trackingType: "reps",
        latestFeedback: makeFeedback({ effortRating: "failed" }),
        recentWorkingWeight: null,
        consecutiveDirectionCount: 2,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("FAILED_SETS");
  });

  it("FAILED_SETS: holds when no prior weight data on second failure", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({ effortRating: "failed" }),
        recentWorkingWeight: null,
        consecutiveDirectionCount: 2,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("NO_PRIOR_WEIGHT");
  });

  it("POOR_RECOVERY: holds when sore, regardless of effort", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        recoveryRating: "sore",
        consecutiveDirectionCount: 5,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("POOR_RECOVERY");
  });

  it("BELOW_TARGET: holds when performance < 0.85", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 0.8,
        }),
        consecutiveDirectionCount: 5,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("BELOW_TARGET");
  });

  it("BELOW_TARGET: does not fire at exactly 0.85", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "moderate",
          performanceRatio: 0.85,
        }),
      }),
    );
    expect(result.ruleKey).not.toBe("BELOW_TARGET");
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — unsupported tracking types
// ---------------------------------------------------------------------------
describe("evaluateProgression — unsupported tracking types", () => {
  it("returns hold with UNSUPPORTED_TRACKING for time", () => {
    const result = evaluateProgression(makeInputs({ trackingType: "time" }));
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("UNSUPPORTED_TRACKING");
  });

  it("returns hold with UNSUPPORTED_TRACKING for distance", () => {
    const result = evaluateProgression(
      makeInputs({ trackingType: "distance" }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("UNSUPPORTED_TRACKING");
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — easy + on target (progressive rules)
// ---------------------------------------------------------------------------
describe("evaluateProgression — easy on target", () => {
  it("EASY_TARGET_REPS: suggests per-set rep targets on first easy session when reps not at max", () => {
    const setWith12Max: Set = {
      repsMin: 8,
      repsMax: 12,
      restMinutes: 2,
      restSeconds: 0,
      time: undefined,
      isWarmup: false,
    };
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [setWith12Max],
        completedRepsPerSet: [10],
      }),
    );
    expect(result.action).toBe("increase_reps");
    expect(result.ruleKey).toBe("EASY_TARGET_REPS");
    expect(result.suggestedRepsPerSet).toEqual([11]);
  });

  it("EASY_TARGET_REPS: caps per-set suggestion at repsMax", () => {
    const setAtMax: Set = {
      repsMin: 8,
      repsMax: 12,
      restMinutes: 2,
      restSeconds: 0,
      time: undefined,
      isWarmup: false,
    };
    // completed 12 which equals repsMax on the first (and only) set → should increase load
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [setAtMax],
        completedRepsPerSet: [12],
        recentWorkingWeight: 100,
        equipment: "barbell",
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(102.5);
  });

  it("EASY_TARGET_LOAD: increases load when first two sets are at repsMax", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recentWorkingWeight: 100,
        equipment: "barbell",
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.ruleKey).toBe("EASY_TARGET_LOAD");
    expect(result.suggestedWeight).toBe(102.5);
  });

  it("EASY_TARGET_LOAD: falls back to load increase when no completed reps data", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        recentWorkingWeight: 80,
        equipment: "barbell",
        completedRepsPerSet: undefined,
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(82.5);
  });

  it("EASY_TARGET_LOAD: uses dumbbell increment for dumbbell equipment", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recentWorkingWeight: 20,
        equipment: "dumbbell",
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(22);
  });

  it("EASY_HOLD_REQUESTED: holds when user explicitly chose to keep it steady", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
          progressionIntent: "hold",
        }),
        consecutiveDirectionCount: 5,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("EASY_HOLD_REQUESTED");
  });

  it("EASY_TARGET_REPS: suggests per-set reps for reps-only tracking when not at max", () => {
    const bodyweightSet: Set = {
      repsMin: 8,
      repsMax: 12,
      restMinutes: 2,
      restSeconds: 0,
      time: undefined,
      isWarmup: false,
    };
    const result = evaluateProgression(
      makeInputs({
        trackingType: "reps",
        equipment: "body weight",
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        recentWorkingWeight: null,
        currentSets: [bodyweightSet],
        completedRepsPerSet: [10],
      }),
    );
    expect(result.action).toBe("increase_reps");
    expect(result.suggestedRepsPerSet).toEqual([11]);
  });

  it("UNSUPPORTED_TRACKING: holds for body weight equipment with weight tracking", () => {
    const result = evaluateProgression(
      makeInputs({
        equipment: "body weight",
        trackingType: "weight",
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("UNSUPPORTED_TRACKING");
  });

  it("multi-set: suggests per-set targets for each set individually", () => {
    const sets: Set[] = [
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
    ];
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: sets,
        completedRepsPerSet: [11, 10, 9],
      }),
    );
    expect(result.action).toBe("increase_reps");
    expect(result.suggestedRepsPerSet).toEqual([12, 11, 10]);
  });

  it("multi-set: increases load when first two sets hit repsMax, even if third set lags", () => {
    const sets: Set[] = [
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
        isWarmup: false,
      },
    ];
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: sets,
        completedRepsPerSet: [12, 12, 9],
        recentWorkingWeight: 100,
        equipment: "barbell",
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(102.5);
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — moderate and hard
// ---------------------------------------------------------------------------
describe("evaluateProgression — moderate and hard", () => {
  it("MODERATE_TARGET: holds when effort is moderate and on target", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "moderate",
          performanceRatio: 1.0,
        }),
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("MODERATE_TARGET");
  });

  it("HARD_TARGET: holds when effort is hard and all sets completed", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "hard",
          performanceRatio: 1.0,
        }),
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("HARD_TARGET");
  });

  it("MODERATE_TARGET: does not fire when performance is below 0.85", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "moderate",
          performanceRatio: 0.8,
        }),
      }),
    );
    expect(result.ruleKey).toBe("BELOW_TARGET");
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — recovery context
// ---------------------------------------------------------------------------
describe("evaluateProgression — recovery context", () => {
  it("proceeds to increase_load when recovery is fresh", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recoveryRating: "fresh",
        recentWorkingWeight: 100,
      }),
    );
    expect(result.action).toBe("increase_load");
  });

  it("proceeds to increase_load when recovery is mild", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recoveryRating: "mild",
        recentWorkingWeight: 100,
      }),
    );
    expect(result.action).toBe("increase_load");
  });

  it("holds when recovery is null (not yet checked)", () => {
    // No POOR_RECOVERY rule fires for null — engine proceeds normally
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recoveryRating: null,
        recentWorkingWeight: 100,
      }),
    );
    // Null recovery does not block progression
    expect(result.action).toBe("increase_load");
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — 3-week progressive overload scenario
// ---------------------------------------------------------------------------
describe("evaluateProgression — 3-week progressive overload scenario", () => {
  it("week 1: first easy session suggests load increase (consecutive = 1, all at max)", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        completedRepsPerSet: [10],
        recentWorkingWeight: 80,
      }),
    );
    expect(result.action).toBe("increase_load");
    expect(result.suggestedWeight).toBe(82.5);
  });

  it("week 2: moderate effort after increase → hold (consolidate)", () => {
    const result = evaluateProgression(
      makeInputs({
        latestFeedback: makeFeedback({
          effortRating: "moderate",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
        currentSets: [FIXED_REP_SET],
        recentWorkingWeight: 82.5,
      }),
    );
    expect(result.action).toBe("hold");
    expect(result.ruleKey).toBe("MODERATE_TARGET");
  });
});

// ---------------------------------------------------------------------------
// evaluateProgression — explanation strings
// ---------------------------------------------------------------------------
describe("evaluateProgression — explanation strings", () => {
  it("does not contain em dashes in any explanation", () => {
    const scenarios: Partial<ProgressionEngineInputs>[] = [
      { latestFeedback: makeFeedback({ painFlag: "pain" }) },
      {
        latestFeedback: makeFeedback({ effortRating: "failed" }),
        recentWorkingWeight: 100,
      },
      {
        recoveryRating: "sore",
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
      },
      {
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 1,
      },
      {
        latestFeedback: makeFeedback({
          effortRating: "easy",
          performanceRatio: 1.0,
        }),
        consecutiveDirectionCount: 2,
        currentSets: [FIXED_REP_SET],
        recentWorkingWeight: 100,
      },
      {
        latestFeedback: makeFeedback({
          effortRating: "moderate",
          performanceRatio: 1.0,
        }),
      },
      {
        latestFeedback: makeFeedback({
          effortRating: "hard",
          performanceRatio: 1.0,
        }),
      },
    ];
    for (const scenario of scenarios) {
      const result = evaluateProgression(makeInputs(scenario));
      expect(result.explanation).not.toContain("—");
    }
  });
});
