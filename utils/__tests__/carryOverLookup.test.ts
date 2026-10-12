import {
  buildExerciseMap,
  findLastAvailableSetData,
  type CarryOverWorkout,
} from "../carryOverLookup";
import { rowIdentity, type RowIdentity } from "../exerciseInstance";

const makeSet = (
  overrides: Partial<
    CarryOverWorkout["exercises"][number]["sets"][number]
  > = {},
) => ({
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
  it("reports the training day of the session the set came from", () => {
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        local_date: "2026-09-12",
        exercises: [{ exercise_id: 1, sets: [makeSet({ weight: 60 })] }],
      },
    ];
    const params = {
      isWarmup: false,
      ordinal: 0,
      previousWorkoutData,
      prevExercisesByExerciseId: buildExerciseMap(previousWorkoutData),
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    };

    expect(
      findLastAvailableSetData({ ...params, exerciseId: 1 }),
    ).toMatchObject({ weight: 60, local_date: "2026-09-12" });
    // Found by position after a swap: still dated.
    expect(
      findLastAvailableSetData({
        ...params,
        exerciseId: 99,
        exercisePosition: 0,
      }),
    ).toMatchObject({ weight: 60, local_date: "2026-09-12" });
  });

  it("carries the set's note and its session's note", () => {
    const previousWorkoutData: CarryOverWorkout[] = [
      {
        local_date: "2026-09-12",
        notes: "Slept badly",
        exercises: [
          {
            exercise_id: 1,
            sets: [
              makeSet(),
              makeSet({ set_id: 2, note: "shoulder on rep 6" }),
            ],
          },
        ],
      },
    ];
    const params = {
      isWarmup: false,
      previousWorkoutData,
      prevExercisesByExerciseId: buildExerciseMap(previousWorkoutData),
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    };

    expect(
      findLastAvailableSetData({ ...params, exerciseId: 1, ordinal: 1 }),
    ).toMatchObject({
      note: "shoulder on rep 6",
      workout_notes: "Slept badly",
    });
    // Found by position after a swap: the session note still comes along.
    expect(
      findLastAvailableSetData({
        ...params,
        exerciseId: 99,
        ordinal: 0,
        exercisePosition: 0,
      }),
    ).toMatchObject({ workout_notes: "Slept badly" });
  });

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

describe("two blocks of the same exercise", () => {
  // The workout: heavy squats (plan row 11), bench, back-off squats (row 13).
  const rows = [
    { exercise_id: 1, id: 11 },
    { exercise_id: 2, id: 12 },
    { exercise_id: 1, id: 13 },
  ];
  const heavy = rowIdentity(rows, 0);
  const backOff = rowIdentity(rows, 2);
  const lookup = (data: CarryOverWorkout[], row: RowIdentity, position = 0) =>
    findLastAvailableSetData({
      exerciseId: 1,
      isWarmup: false,
      ordinal: 0,
      exercisePosition: position,
      row,
      previousWorkoutData: data,
      prevExercisesByExerciseId: buildExerciseMap(data),
      globalExercisesByExerciseId: new Map(),
      alwaysUseGlobalHistory: false,
    })?.weight;

  describe("older sessions, without plan rows", () => {
    // Last session: 140, bench, 110. The one before only had 135.
    const data: CarryOverWorkout[] = [
      {
        local_date: "2026-09-12",
        exercises: [
          { exercise_id: 1, sets: [makeSet({ weight: 140 })] },
          { exercise_id: 2, sets: [makeSet({ weight: 80 })] },
          { exercise_id: 1, sets: [makeSet({ weight: 110 })] },
        ],
      },
      {
        local_date: "2026-09-09",
        exercises: [{ exercise_id: 1, sets: [makeSet({ weight: 135 })] }],
      },
    ];

    it("prefills each block from the same block by order", () => {
      expect(lookup(data, heavy)).toBe(140);
      expect(lookup(data, backOff, 2)).toBe(110);
    });

    it("falls back to the first block when the session had fewer", () => {
      expect(lookup([data[1]], backOff, 2)).toBe(135);
    });
  });

  describe("sessions that recorded the plan row", () => {
    // Last session skipped the heavy block; the one before logged both.
    const data: CarryOverWorkout[] = [
      {
        local_date: "2026-09-12",
        exercises: [
          {
            exercise_id: 1,
            user_workout_exercise_id: 13,
            sets: [makeSet({ weight: 112.5 })],
          },
        ],
      },
      {
        local_date: "2026-09-09",
        exercises: [
          {
            exercise_id: 1,
            user_workout_exercise_id: 11,
            sets: [makeSet({ weight: 140 })],
          },
          {
            exercise_id: 1,
            user_workout_exercise_id: 13,
            sets: [makeSet({ weight: 110 })],
          },
        ],
      },
    ];

    it("never fills a skipped block from the other block", () => {
      expect(lookup(data, heavy)).toBe(140);
      expect(lookup(data, backOff, 2)).toBe(112.5);
    });
  });
});
