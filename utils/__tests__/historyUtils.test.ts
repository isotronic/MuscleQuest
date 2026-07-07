import { findHistoricalSetByOrdinal } from "../historyUtils";

const makeSet = (overrides: Record<string, any> = {}) => ({
  set_id: 1,
  set_number: 1,
  weight: 100,
  reps: 8,
  time: null,
  distance: null,
  is_warmup: false,
  ...overrides,
});

describe("findHistoricalSetByOrdinal", () => {
  it("returns the set at the same ordinal when it exists in history", () => {
    const historyExercises = [
      {
        exercise_id: 1,
        sets: [makeSet({ set_id: 1, weight: 100 }), makeSet({ set_id: 2, weight: 110 })],
      },
    ];

    const result = findHistoricalSetByOrdinal(
      [{ isWarmup: false }, { isWarmup: false }],
      1,
      historyExercises as any,
    );

    expect(result?.weight).toBe(110);
  });

  it("falls back to the last historical set when a new set was added this session", () => {
    // History only has 2 working sets; current exercise now has a 3rd (index 2).
    const historyExercises = [
      {
        exercise_id: 1,
        sets: [makeSet({ set_id: 1, weight: 100 }), makeSet({ set_id: 2, weight: 110 })],
      },
    ];

    const result = findHistoricalSetByOrdinal(
      [{ isWarmup: false }, { isWarmup: false }, { isWarmup: false }],
      2,
      historyExercises as any,
    );

    expect(result?.weight).toBe(110);
  });

  it("does not skip to an older history entry just because it has more sets at that ordinal", () => {
    const historyExercises = [
      {
        exercise_id: 1,
        sets: [makeSet({ set_id: 1, weight: 90 }), makeSet({ set_id: 2, weight: 95 })],
      },
      {
        exercise_id: 1,
        sets: [
          makeSet({ set_id: 3, weight: 70 }),
          makeSet({ set_id: 4, weight: 75 }),
          makeSet({ set_id: 5, weight: 80 }),
        ],
      },
    ];

    const result = findHistoricalSetByOrdinal(
      [{ isWarmup: false }, { isWarmup: false }, { isWarmup: false }],
      2,
      historyExercises as any,
    );

    expect(result?.weight).toBe(95);
  });

  it("returns undefined when there is no history", () => {
    const result = findHistoricalSetByOrdinal(
      [{ isWarmup: false }],
      0,
      [],
    );

    expect(result).toBeUndefined();
  });
});
