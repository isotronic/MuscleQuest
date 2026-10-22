import { setupUserDb } from "@/utils/db/testing/setupUserDb";
import { appendExercisesToWorkout, duplicatePlan } from "@/utils/db/plans";
import {
  countSavedWorkoutSessions,
  fetchLastCompletedPlanWorkout,
  fetchSetDurationsForExercises,
  linkCompletedWorkoutToWorkout,
} from "@/utils/db/workouts";
import { createStandaloneWorkout } from "@/utils/db/standaloneWorkouts";
import type { UserExercise } from "@/store/workoutStore";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

const userExercise = (
  exercise_id: number,
  extra: Partial<UserExercise> = {},
): UserExercise =>
  ({
    exercise_id,
    name: `Exercise ${exercise_id}`,
    sets: [
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 2,
        restSeconds: 0,
        time: undefined,
      },
    ],
    ...extra,
  }) as UserExercise;

describe("plan copy and workout lookups", () => {
  let sqlite: Awaited<ReturnType<typeof setupUserDb>>["sqlite"];

  const rows = (sql: string, ...params: (number | string)[]) =>
    sqlite.prepare(sql).all(...params);

  beforeEach(async () => {
    ({ sqlite } = await setupUserDb());
    sqlite.exec(`
      INSERT INTO exercises (exercise_id, name, tracking_type)
      VALUES (100, 'Bench Press', 'weight'), (200, 'Squat', 'weight'),
             (300, 'Row', 'weight'), (400, 'Pull-up', 'reps');
    `);
  });

  afterEach(() => sqlite.close());

  describe("duplicatePlan", () => {
    let newPlanId: number;

    const exerciseColumns = `exercise_id, sets, exercise_order, superset_group_id, tracking_type_override`;

    beforeEach(async () => {
      sqlite.exec(`
        INSERT INTO user_plans (id, name, image_url) VALUES (1, 'Source', 'old.jpg');
        INSERT INTO user_workouts (id, plan_id, name, workout_order, is_deleted)
        VALUES (12, 1, 'Pull', 1, FALSE),
               (11, 1, 'Push', 0, FALSE),
               (13, 1, 'Deleted Day', 2, TRUE);
        INSERT INTO user_workout_exercises
          (workout_id, exercise_id, sets, exercise_order, is_deleted,
           superset_group_id, tracking_type_override)
        VALUES (11, 100, '[{"repsMin":5}]', 0, FALSE, 'g', NULL),
               (11, 300, '[{"repsMin":6}]', 1, FALSE, 'g', NULL),
               (11, 200, '[]', 2, TRUE, NULL, NULL),
               (12, 400, '[{"repsMin":7}]', 0, FALSE, NULL, 'weight');
        INSERT INTO plan_schedule (plan_id, day_of_week, workout_id)
        VALUES (1, 0, 11), (1, 3, 12);
      `);
      newPlanId = await duplicatePlan(1, "Copy", "new.jpg");
    });

    const newWorkouts = () =>
      rows(
        `SELECT id, name, workout_order FROM user_workouts
         WHERE plan_id = ? ORDER BY workout_order`,
        newPlanId,
      ) as { id: number; name: string; workout_order: number }[];

    it("creates the plan with the given name and image", () => {
      expect(
        rows(`SELECT name, image_url FROM user_plans WHERE id = ?`, newPlanId),
      ).toEqual([{ name: "Copy", image_url: "new.jpg" }]);
    });

    it("copies the live workouts and exercises in order", () => {
      const workouts = newWorkouts();
      expect(workouts.map((w) => w.name)).toEqual(["Push", "Pull"]);

      const copied = (id: number) =>
        rows(
          `SELECT ${exerciseColumns} FROM user_workout_exercises
           WHERE workout_id = ? ORDER BY exercise_order`,
          id,
        );
      expect(copied(workouts[0].id)).toEqual([
        {
          exercise_id: 100,
          sets: '[{"repsMin":5}]',
          exercise_order: 0,
          superset_group_id: "g",
          tracking_type_override: null,
        },
        {
          exercise_id: 300,
          sets: '[{"repsMin":6}]',
          exercise_order: 1,
          superset_group_id: "g",
          tracking_type_override: null,
        },
      ]);
      expect(copied(workouts[1].id)).toEqual([
        {
          exercise_id: 400,
          sets: '[{"repsMin":7}]',
          exercise_order: 0,
          superset_group_id: null,
          tracking_type_override: "weight",
        },
      ]);
    });

    it("points the copied schedule at the new workouts", () => {
      const [push, pull] = newWorkouts();

      expect(
        rows(
          `SELECT day_of_week, workout_id FROM plan_schedule
           WHERE plan_id = ? ORDER BY day_of_week`,
          newPlanId,
        ),
      ).toEqual([
        { day_of_week: 0, workout_id: push.id },
        { day_of_week: 3, workout_id: pull.id },
      ]);
    });

    it("leaves the source plan as it was", () => {
      expect(
        rows(`SELECT name, image_url FROM user_plans WHERE id = 1`),
      ).toEqual([{ name: "Source", image_url: "old.jpg" }]);
      expect(
        rows(
          `SELECT day_of_week, workout_id FROM plan_schedule
           WHERE plan_id = 1 ORDER BY day_of_week`,
        ),
      ).toEqual([
        { day_of_week: 0, workout_id: 11 },
        { day_of_week: 3, workout_id: 12 },
      ]);
      expect(
        rows(
          `SELECT COUNT(*) AS n FROM user_workout_exercises WHERE workout_id = 11`,
        ),
      ).toEqual([{ n: 3 }]);
    });
  });

  describe("appendExercisesToWorkout", () => {
    const orders = (workoutId: number) =>
      rows(
        `SELECT exercise_id, exercise_order FROM user_workout_exercises
         WHERE workout_id = ? AND is_deleted = FALSE ORDER BY exercise_order`,
        workoutId,
      );

    it("continues after the highest live order", async () => {
      sqlite.exec(`
        INSERT INTO user_workouts (id, name) VALUES (1, 'Push');
        INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, is_deleted)
        VALUES (1, 100, '[]', 0, FALSE), (1, 200, '[]', 1, FALSE),
               (1, 300, '[]', 5, TRUE);
      `);

      await appendExercisesToWorkout(1, [userExercise(300), userExercise(400)]);

      expect(orders(1)).toEqual([
        { exercise_id: 100, exercise_order: 0 },
        { exercise_id: 200, exercise_order: 1 },
        { exercise_id: 300, exercise_order: 2 },
        { exercise_id: 400, exercise_order: 3 },
      ]);
    });

    it("starts at zero on an empty workout", async () => {
      sqlite.exec(`INSERT INTO user_workouts (id, name) VALUES (1, 'Push');`);

      await appendExercisesToWorkout(1, [userExercise(100)]);

      expect(orders(1)).toEqual([{ exercise_id: 100, exercise_order: 0 }]);
    });
  });

  describe("completed session lookups", () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO user_plans (id, name) VALUES (1, 'Plan'), (2, 'Unused');
        INSERT INTO user_workouts (id, plan_id, name)
        VALUES (11, 1, 'Push'), (12, 1, 'Pull'), (13, 1, 'Legs');
        INSERT INTO completed_workouts
          (id, plan_id, workout_id, date_completed, local_date, duration, total_sets_completed, is_deleted)
        VALUES (1, 1, 11, '2026-10-01T08:00:00.000Z', '2026-10-01', 600, 1, 0),
               (2, 1, 12, '2026-10-05T08:00:00.000Z', '2026-10-05', 600, 1, 0),
               (3, 1, 13, '2026-10-05T08:00:00.000Z', '2026-10-05', 600, 1, 0),
               (4, 1, 11, '2026-10-09T08:00:00.000Z', '2026-10-09', 600, 1, 1),
               (5, NULL, NULL, '2026-10-10T08:00:00.000Z', '2026-10-10', 600, 1, 0);
      `);
    });

    it("finds the newest live session, breaking date ties by id", async () => {
      expect(await fetchLastCompletedPlanWorkout(1)).toBe(13);
    });

    it("returns null for a plan with no sessions", async () => {
      expect(await fetchLastCompletedPlanWorkout(2)).toBeNull();
    });

    it("counts only live sessions of saved workouts", async () => {
      expect(await countSavedWorkoutSessions()).toBe(3);
    });

    it("links a session to a workout", async () => {
      await linkCompletedWorkoutToWorkout(5, 12);

      expect(
        rows(`SELECT workout_id FROM completed_workouts WHERE id = 5`),
      ).toEqual([{ workout_id: 12 }]);
    });
  });

  describe("fetchSetDurationsForExercises", () => {
    it("returns nothing for no exercises", async () => {
      expect(await fetchSetDurationsForExercises([])).toEqual({});
    });

    it("groups live durations by exercise", async () => {
      sqlite.exec(`
        INSERT INTO completed_workouts
          (id, date_completed, local_date, duration, total_sets_completed)
        VALUES (1, '2026-10-01T08:00:00.000Z', '2026-10-01', 600, 4);
        INSERT INTO completed_exercises (id, completed_workout_id, exercise_id)
        VALUES (10, 1, 100), (20, 1, 200);
        INSERT INTO completed_sets
          (completed_exercise_id, set_number, reps, set_duration, is_deleted)
        VALUES (10, 1, 8, 40, 0), (10, 2, 6, 0, 0), (10, 3, 5, 50, 1),
               (20, 1, 5, 30, 0);
      `);

      expect(await fetchSetDurationsForExercises([100, 200])).toEqual({
        100: [{ duration: 40, reps: 8 }],
        200: [{ duration: 30, reps: 5 }],
      });
    });
  });

  it("creates a standalone workout with its exercises in order", async () => {
    const id = await createStandaloneWorkout("Arms", [
      userExercise(100, { supersetGroupId: "g" }),
      userExercise(300, { supersetGroupId: "g" }),
      userExercise(400, { tracking_type_override: "weight" }),
    ]);

    expect(
      rows(`SELECT plan_id, name FROM user_workouts WHERE id = ?`, id),
    ).toEqual([{ plan_id: null, name: "Arms" }]);
    expect(
      rows(
        `SELECT exercise_id, exercise_order, superset_group_id, tracking_type_override
         FROM user_workout_exercises WHERE workout_id = ? ORDER BY exercise_order`,
        id,
      ),
    ).toEqual([
      {
        exercise_id: 100,
        exercise_order: 0,
        superset_group_id: "g",
        tracking_type_override: null,
      },
      {
        exercise_id: 300,
        exercise_order: 1,
        superset_group_id: "g",
        tracking_type_override: null,
      },
      {
        exercise_id: 400,
        exercise_order: 2,
        superset_group_id: null,
        tracking_type_override: "weight",
      },
    ]);
  });
});
