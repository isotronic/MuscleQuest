import {
  buildExerciseMap,
  findLastAvailableSetData,
  type CarryOverWorkout,
} from "../carryOverLookup";

const makeSet = (overrides: Partial<CarryOverWorkout["exercises"][number]["sets"][number]> = {}) => ({
  set_id: 1,
  set_number: 1,
  weight: 100,
  reps: 8,
  time: null,
  distance: null,
  is_warmup: false,
  ...overrides,
});

describe("findLastAvailableSetData", () => {
  it("returns the set at the same ordinal when it exists in the most recent session", () => {
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet({ set_id: 1, weight: 100 }),
              makeSet({ set_id: 2, weight: 110 }),
            ],
          },
        ],
      },
    ];
    const map = buildExerciseMap(previousWorkoutData);

    const result = findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 1,
      previousWorkoutData,
      prevExercisesByExerciseId: map,
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    });

    expect(result?.weight).toBe(110);
  });

  it("falls back to the last set of the previous session when a new set was added this session", () => {
    // Previous session only had 2 working sets; this session's set index 2 (3rd set)
    // has no matching ordinal in the previous session.
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet({ set_id: 1, weight: 100 }),
              makeSet({ set_id: 2, weight: 110 }),
            ],
          },
        ],
      },
    ];
    const map = buildExerciseMap(previousWorkoutData);

    const result = findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 2,
      previousWorkoutData,
      prevExercisesByExerciseId: map,
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    });

    // Should carry over from the last set of the most recent session, not 0/null.
    expect(result?.weight).toBe(110);
  });

  it("does not skip to an older session just because it has more sets at that ordinal", () => {
    // Two sessions ago had 3 sets (so ordinal 2 exists there), but the most
    // recent session only had 2 sets. The fallback should stay on the most
    // recent session's last set rather than reaching further back in history.
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet({ set_id: 1, weight: 90 }),
              makeSet({ set_id: 2, weight: 95 }),
            ],
          },
        ],
      },
      {
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet({ set_id: 3, weight: 70 }),
              makeSet({ set_id: 4, weight: 75 }),
              makeSet({ set_id: 5, weight: 80 }),
            ],
          },
        ],
      },
    ];
    const map = buildExerciseMap(previousWorkoutData);

    const result = findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 2,
      previousWorkoutData,
      prevExercisesByExerciseId: map,
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    });

    expect(result?.weight).toBe(95);
  });

  it("returns null (not a false-y 0 sentinel) when there is no history at all", () => {
    const map = buildExerciseMap(null);

    const result = findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 0,
      previousWorkoutData: null,
      prevExercisesByExerciseId: map,
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    });

    expect(result).toBeNull();
  });

  it("keeps warmup and working sets separate when falling back", () => {
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet({ set_id: 1, weight: 20, is_warmup: true }),
              makeSet({ set_id: 2, weight: 100 }),
              makeSet({ set_id: 3, weight: 110 }),
            ],
          },
        ],
      },
    ];
    const map = buildExerciseMap(previousWorkoutData);

    const result = findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 5,
      previousWorkoutData,
      prevExercisesByExerciseId: map,
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    });

    expect(result?.weight).toBe(110);
  });
});
