import {
  buildCompletedExercises,
  unsavedSetNotes,
} from "../completedExercises";

const exercise = (id: number, sets = 3) =>
  ({
    exercise_id: id,
    name: `Ex ${id}`,
    tracking_type: "weight",
    sets: Array.from({ length: sets }, () => ({
      isWarmup: false,
      repsMin: 8,
      repsMax: 10,
      restMinutes: 1,
      restSeconds: 0,
    })),
  }) as any;

describe("buildCompletedExercises", () => {
  it("carries each completed set's note and skips uncompleted sets", () => {
    const result = buildCompletedExercises({
      exercises: [exercise(1), exercise(2)],
      completedSets: { 0: { 0: true, 1: true, 2: false }, 1: { 0: false } },
      weightAndReps: {
        0: {
          0: { weight: "100", reps: "5" },
          1: { weight: "100", reps: "5" },
          2: { weight: "100", reps: "5" },
        },
        1: { 0: { weight: "50", reps: "8" } },
      },
      setDurations: {},
      setNotes: { 0: { 1: "felt shoulder on rep 6", 2: "never done" } },
    });

    expect(result).toHaveLength(1);
    expect(result[0].sets.map((s) => [s.set_number, s.note])).toEqual([
      [1, null],
      [2, "felt shoulder on rep 6"],
    ]);
  });

  it("keeps the values it saved before notes existed", () => {
    const [saved] = buildCompletedExercises({
      exercises: [exercise(1, 1)],
      completedSets: { 0: { 0: true } },
      weightAndReps: { 0: { 0: { weight: "62.5", reps: "8" } } },
      setDurations: { 0: { 0: 42 } },
      setNotes: {},
    });

    expect(saved).toEqual({
      exercise_id: 1,
      resolved_tracking_type: "weight",
      sets: [
        {
          set_number: 1,
          weight: 62.5,
          reps: 8,
          time: null,
          distance: null,
          is_warmup: false,
          is_drop_set: false,
          is_to_failure: false,
          set_duration: 42,
          note: null,
        },
      ],
    });
  });
});

describe("unsavedSetNotes", () => {
  it("lists notes on sets the save leaves out", () => {
    const session = {
      exercises: [exercise(1), exercise(2)],
      completedSets: { 0: { 0: true, 1: false } },
      weightAndReps: { 0: { 0: { weight: "100", reps: "5" } } },
      setDurations: {},
      setNotes: {
        0: { 0: "kept", 1: "skipped, elbow twinge" },
        1: { 2: "never started" },
      },
    };

    expect(unsavedSetNotes(session)).toEqual([
      { exerciseName: "Ex 1", setNumber: 2, note: "skipped, elbow twinge" },
      { exerciseName: "Ex 2", setNumber: 3, note: "never started" },
    ]);
  });
});
