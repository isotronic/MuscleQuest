import {
  MAJOR_MUSCLES,
  planMuscleSets,
  plannedMuscleSets,
  untrainedMuscles,
  type PlannedExercise,
} from "../plannedMuscleSets";

const sets = (working: number, warmup = 0) => [
  ...Array.from({ length: warmup }, () => ({ isWarmup: true })),
  ...Array.from({ length: working }, () => ({})),
];

const bench: PlannedExercise = {
  target_muscle: "pectorals",
  secondary_muscles: ["triceps", "shoulders"],
  sets: sets(3, 2),
};
const row: PlannedExercise = {
  target_muscle: "upper back",
  secondary_muscles: '["biceps","back"]',
  sets: sets(4),
};

describe("plannedMuscleSets", () => {
  it("counts working sets for the target and half for secondaries", () => {
    expect(plannedMuscleSets([bench], 0.5)).toEqual({
      pectorals: 3,
      triceps: 1.5,
      delts: 1.5,
    });
  });

  it("leaves secondaries out at weight 0", () => {
    expect(plannedMuscleSets([bench], 0)).toEqual({ pectorals: 3 });
  });

  it("parses a JSON string and skips a secondary that is the target", () => {
    // "back" folds into "upper back", the target, so it is not counted twice.
    expect(plannedMuscleSets([row], 0.5)).toEqual({
      "upper back": 4,
      biceps: 2,
    });
  });

  it("ignores exercises without working sets and cardio", () => {
    expect(
      plannedMuscleSets(
        [
          { target_muscle: "quads", sets: sets(0, 2) },
          { target_muscle: "cardiovascular system", sets: sets(1) },
          { target_muscle: "calves", secondary_muscles: "not json", sets: [] },
        ],
        0.5,
      ),
    ).toEqual({});
  });
});

describe("planMuscleSets", () => {
  const workouts = [{ exercises: [bench] }, { exercises: [row] }];

  it("counts each workout once per scheduled day", () => {
    // Bench day twice, row day once.
    expect(planMuscleSets(workouts, [0, 1, 0], 0)).toEqual({
      totals: { pectorals: 6, "upper back": 4 },
      weekly: true,
    });
  });

  it("counts each workout once without a schedule", () => {
    expect(planMuscleSets(workouts, [], 0)).toEqual({
      totals: { pectorals: 3, "upper back": 4 },
      weekly: false,
    });
  });

  it("ignores schedule entries for workouts that are gone", () => {
    expect(planMuscleSets(workouts, [-1, 5], 0).weekly).toBe(false);
  });
});

describe("untrainedMuscles", () => {
  it("lists the major muscles with no sets, in order", () => {
    const totals = Object.fromEntries(MAJOR_MUSCLES.map((m) => [m, 1]));
    delete totals.hamstrings;
    totals.calves = 0;
    expect(untrainedMuscles(totals)).toEqual(["hamstrings", "calves"]);
  });
});
