import { computeSessionPRs, type SessionPRInput } from "../sessionPRs";
import type { UserExercise } from "@/store/workoutStore";

const exercise = (
  exercise_id: number,
  setCount: number,
  extra: Partial<UserExercise> = {},
): UserExercise =>
  ({
    exercise_id,
    name: `Exercise ${exercise_id}`,
    tracking_type: "weight",
    sets: Array.from({ length: setCount }, () => ({
      repsMin: 5,
      repsMax: 5,
      restMinutes: 0,
      restSeconds: 0,
      time: undefined,
    })),
    ...extra,
  }) as UserExercise;

const e1rm = (weight: number, reps: number) => weight * (1 + reps / 30);

const base = (overrides: Partial<SessionPRInput>): SessionPRInput => ({
  exercises: [exercise(1, 3)],
  completedSets: {},
  weightAndReps: {},
  priorBests: [{ exercise_id: 1, tracking_type: "weight", best: e1rm(100, 5) }],
  weightUnit: "kg",
  distanceUnit: "m",
  bodyWeightKg: 80,
  ...overrides,
});

describe("computeSessionPRs", () => {
  it("flags a completed set that beats the prior best", () => {
    const prs = computeSessionPRs(
      base({
        completedSets: { 0: { 0: true, 1: true } },
        weightAndReps: {
          0: {
            0: { weight: "100", reps: "5" },
            1: { weight: "102.5", reps: "5" },
          },
        },
      }),
    );
    // Equalling the best is not a record.
    expect(prs).toEqual({ 0: [1] });
  });

  it("raises the bar after a PR, so a smaller second one does not count", () => {
    const prs = computeSessionPRs(
      base({
        completedSets: { 0: { 0: true, 1: true, 2: true } },
        weightAndReps: {
          0: {
            0: { weight: "110", reps: "5" },
            1: { weight: "105", reps: "5" },
            2: { weight: "112.5", reps: "5" },
          },
        },
      }),
    );
    expect(prs).toEqual({ 0: [0, 2] });
  });

  it("ignores warm-ups, unfinished sets and exercises with no history", () => {
    const warmup = exercise(1, 2);
    warmup.sets[0].isWarmup = true;
    const prs = computeSessionPRs(
      base({
        exercises: [warmup, exercise(2, 1)],
        completedSets: { 0: { 0: true }, 1: { 0: true } },
        weightAndReps: {
          0: {
            0: { weight: "200", reps: "5" },
            1: { weight: "200", reps: "5" },
          },
          1: { 0: { weight: "50", reps: "5" } },
        },
      }),
    );
    expect(prs).toEqual({});
  });

  it("converts pounds to kg before comparing", () => {
    // 225 lbs is about 102.06 kg: a PR over 100 kg.
    const input = base({
      weightUnit: "lbs",
      completedSets: { 0: { 0: true } },
      weightAndReps: { 0: { 0: { weight: "225", reps: "5" } } },
    });
    expect(computeSessionPRs(input)).toEqual({ 0: [0] });
    // 220 lbs is about 99.79 kg: not one.
    input.weightAndReps = { 0: { 0: { weight: "220", reps: "5" } } };
    expect(computeSessionPRs(input)).toEqual({});
  });

  it("compares under the resolved tracking type", () => {
    const pushup = exercise(5, 1, {
      tracking_type: "reps",
      tracking_type_override: "weight",
    });
    const prs = computeSessionPRs(
      base({
        exercises: [pushup],
        priorBests: [
          { exercise_id: 5, tracking_type: "reps", best: 30 },
          { exercise_id: 5, tracking_type: "weight", best: e1rm(10, 10) },
        ],
        completedSets: { 0: { 0: true } },
        weightAndReps: { 0: { 0: { weight: "12.5", reps: "10" } } },
      }),
    );
    expect(prs).toEqual({ 0: [0] });
  });

  it("scores assisted, paired, time and distance sets like the stats", () => {
    const input = base({
      exercises: [
        exercise(1, 1, { tracking_type: "assisted" }),
        exercise(2, 1, { double_weight: 1 }),
        exercise(3, 1, { tracking_type: "time" }),
        exercise(4, 1, { tracking_type: "distance" }),
      ],
      priorBests: [
        // Body weight 80, 30 assist x 8.
        { exercise_id: 1, tracking_type: "assisted", best: e1rm(50, 8) },
        // 20 kg dumbbells, both counted.
        { exercise_id: 2, tracking_type: "weight", best: e1rm(40, 10) },
        { exercise_id: 3, tracking_type: "time", best: 60 },
        { exercise_id: 4, tracking_type: "distance", best: 5000 },
      ],
      completedSets: {
        0: { 0: true },
        1: { 0: true },
        2: { 0: true },
        3: { 0: true },
      },
      weightAndReps: {
        0: { 0: { weight: "25", reps: "8" } },
        1: { 0: { weight: "21", reps: "10" } },
        2: { 0: { time: "1:05" } },
        3: { 0: { distance: "5" } },
      },
    });
    // Less assistance, heavier dumbbells and a longer hold are records; 5 m
    // is not 5 km.
    expect(computeSessionPRs(input)).toEqual({ 0: [0], 1: [0], 2: [0] });
  });
});
