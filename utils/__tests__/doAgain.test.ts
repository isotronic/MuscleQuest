import { buildDoAgainExercises, findSourceWorkout } from "../doAgain";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import type { Exercise } from "@/utils/db/exercises";
import type { Plan } from "@/hooks/useAllPlansQuery";
import type { Workout } from "@/store/workoutStore";

const libraryRow = (
  exercise_id: number,
  tracking_type = "weight",
): Exercise => ({
  exercise_id,
  name: `Exercise ${exercise_id}`,
  image: [],
  local_animated_uri: "",
  animated_url: "",
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "pectorals",
  secondary_muscles: [],
  description: "",
  tracking_type,
});

const set = (
  flags: { warm?: boolean; drop?: boolean; fail?: boolean } = {},
) => ({
  set_id: 1,
  set_number: 1,
  weight: 60,
  reps: 8,
  time: null,
  distance: null,
  is_warmup: !!flags.warm,
  is_drop_set: !!flags.drop,
  is_to_failure: !!flags.fail,
  set_duration: null,
});

const completed = (
  exercises: CompletedWorkout["exercises"],
): CompletedWorkout => ({
  id: 7,
  workout_id: 3,
  plan_id: 1,
  workout_name: "Push",
  date_completed: "2026-10-01T08:00:00Z",
  local_date: "2026-10-01",
  duration: 3600,
  total_sets_completed: 3,
  exercises,
});

describe("buildDoAgainExercises", () => {
  it("copies exercises, set counts and set types", () => {
    const result = buildDoAgainExercises(
      completed([
        {
          completed_exercise_id: 1,
          exercise_id: 100,
          exercise_name: "Bench",
          exercise_tracking_type: "weight",
          sets: [set({ warm: true }), set(), set({ drop: true, fail: true })],
        },
        {
          completed_exercise_id: 2,
          exercise_id: 200,
          exercise_name: "Plank",
          exercise_tracking_type: "time",
          sets: [set()],
        },
      ]),
      [libraryRow(100), libraryRow(200, "time")],
      90,
    );

    expect(result.map((e) => e.exercise_id)).toEqual([100, 200]);
    expect(
      result[0].sets.map((s) => [s.isWarmup, s.isDropSet, s.isToFailure]),
    ).toEqual([
      [true, false, false],
      [false, false, false],
      [false, true, true],
    ]);
    expect(result[0].sets[0]).toMatchObject({
      restMinutes: 1,
      restSeconds: 30,
      repsMin: 8,
      repsMax: 12,
    });
    expect(result[1].sets).toHaveLength(1);
    expect(result[1].sets[0].time).toBe(30);
    // Weights and reps are left to the history prefill.
    expect(result[0].sets[0]).not.toHaveProperty("weight");
  });

  it("keeps a tracking type override from the session", () => {
    const [exercise] = buildDoAgainExercises(
      completed([
        {
          completed_exercise_id: 1,
          exercise_id: 300,
          exercise_name: "Pull-up",
          exercise_tracking_type: "weight",
          sets: [set()],
        },
      ]),
      [libraryRow(300, "reps")],
      60,
    );
    expect(exercise.tracking_type_override).toBe("weight");
    expect(exercise.tracking_type).toBe("reps");
  });

  it("leaves out exercises no longer in the library, keeps repeats", () => {
    const result = buildDoAgainExercises(
      completed([
        {
          completed_exercise_id: 1,
          exercise_id: 100,
          exercise_name: "Bench",
          exercise_tracking_type: "weight",
          sets: [set()],
        },
        {
          completed_exercise_id: 2,
          exercise_id: 999,
          exercise_name: "Deleted",
          exercise_tracking_type: "weight",
          sets: [set()],
        },
        {
          completed_exercise_id: 3,
          exercise_id: 100,
          exercise_name: "Bench",
          exercise_tracking_type: "weight",
          sets: [set()],
        },
      ]),
      [libraryRow(100)],
      60,
    );
    expect(result.map((e) => e.exercise_id)).toEqual([100, 100]);
  });
});

describe("findSourceWorkout", () => {
  const push: Workout = { id: 3, name: "Push", exercises: [] };
  const legs: Workout = { id: 9, name: "Legs", exercises: [] };
  const plan = { id: 1, name: "PPL", workouts: [push] } as unknown as Plan;

  it("finds a plan workout with its plan", () => {
    expect(findSourceWorkout(3, [plan], [legs])).toEqual({
      workout: push,
      planId: 1,
    });
  });

  it("finds a workout outside plans", () => {
    expect(findSourceWorkout(9, [plan], [legs])).toEqual({
      workout: legs,
      planId: null,
    });
  });

  it("falls back to nothing when the workout was deleted or never saved", () => {
    expect(findSourceWorkout(42, [plan], [legs])).toBeNull();
    expect(findSourceWorkout(null, [plan], [legs])).toBeNull();
  });
});
