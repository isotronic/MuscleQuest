import { exercisesFromWorkout } from "../logPastWorkout";
import type { Workout } from "@/store/workoutStore";

const workout = {
  id: 2,
  name: "Push",
  exercises: [
    {
      exercise_id: 100,
      name: "Pull-up",
      tracking_type: "reps",
      tracking_type_override: "weight",
      sets: [
        {
          repsMin: 6,
          repsMax: 8,
          restMinutes: 1,
          restSeconds: 0,
          isWarmup: true,
        },
        {
          repsMin: 6,
          repsMax: undefined,
          restMinutes: 1,
          restSeconds: 0,
          isToFailure: true,
        },
      ],
    },
    {
      exercise_id: 200,
      name: "Plank",
      tracking_type: "time",
      sets: [{ restMinutes: 1, restSeconds: 0, time: 45 }],
    },
  ],
} as unknown as Workout;

describe("exercisesFromWorkout", () => {
  it("prefills exercises, set counts, set types and targets", () => {
    let id = -1;
    const result = exercisesFromWorkout(workout, () => id--);

    expect(
      result.map((e) => [e.exercise_id, e.exercise_tracking_type]),
    ).toEqual([
      [100, "weight"],
      [200, "time"],
    ]);
    expect(result[0].sets).toEqual([
      expect.objectContaining({
        set_number: 1,
        reps: 8,
        weight: null,
        is_warmup: true,
      }),
      expect.objectContaining({ set_number: 2, reps: 6, is_to_failure: true }),
    ]);
    expect(result[1].sets[0]).toMatchObject({ time: 45, reps: null });
  });

  it("hands out distinct negative ids", () => {
    let id = -1;
    const result = exercisesFromWorkout(workout, () => id--);
    const ids = result.flatMap((e) => [
      e.completed_exercise_id,
      ...e.sets.map((s) => s.set_id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((n) => n < 0)).toBe(true);
  });
});
