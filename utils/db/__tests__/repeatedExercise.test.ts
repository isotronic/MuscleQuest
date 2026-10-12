// A workout can hold the same exercise twice ("heavy squat triples" then
// "back-off squats"). Each block saves and reads back as its own exercise.
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase as openConnection } from "@/utils/db/connection";
import {
  fetchCompletedWorkoutById,
  saveCompletedWorkout,
} from "@/utils/db/workouts";
import { updateWorkoutPlan } from "@/utils/db/plans";
import type { UserExercise } from "@/store/workoutStore";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

const sets = (weight: number, reps: number) =>
  [1, 2].map((set_number) => ({
    set_number,
    weight,
    reps,
    time: null,
    distance: null,
  }));

describe("the same exercise twice in one workout", () => {
  let sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"];

  beforeEach(async () => {
    const created = createNodeSqliteDb();
    sqlite = created.sqlite;
    await runMigrations(created.db);
    // Plan order: squat (heavy), bench, squat (back-off).
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'Plan');
      INSERT INTO user_workouts (id, plan_id, name) VALUES (2, 1, 'Legs');
      INSERT INTO exercises (exercise_id, name, tracking_type)
        VALUES (100, 'Squat', 'weight'), (200, 'Bench Press', 'weight');
      INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, exercise_order)
        VALUES (1, 2, 100, '[]', 0), (2, 2, 200, '[]', 1), (3, 2, 100, '[]', 2);
    `);
    (openConnection as jest.Mock).mockResolvedValue(created.db);
  });

  afterEach(() => sqlite.close());

  it("saves two rows and reads both back in plan order", async () => {
    const id = await saveCompletedWorkout(1, 2, 600, 6, false, [
      { exercise_id: 100, sets: sets(140, 3) },
      { exercise_id: 200, sets: sets(80, 8) },
      { exercise_id: 100, sets: sets(110, 8) },
    ]);

    expect(
      sqlite
        .prepare(
          `SELECT exercise_id FROM completed_exercises WHERE completed_workout_id = ? ORDER BY id`,
        )
        .all(id),
    ).toEqual([
      { exercise_id: 100 },
      { exercise_id: 200 },
      { exercise_id: 100 },
    ]);

    const workout = await fetchCompletedWorkoutById(id);
    expect(
      workout.exercises.map((e) => [
        e.exercise_id,
        e.sets.map((s) => s.weight),
      ]),
    ).toEqual([
      [100, [140, 140]],
      [200, [80, 80]],
      [100, [110, 110]],
    ]);
  });

  it("keeps two plan rows when the plan is saved, matched in order", async () => {
    const block = (exercise_id: number, reps: number) =>
      ({
        exercise_id,
        name: "",
        sets: [
          { repsMin: reps, repsMax: reps, restMinutes: 2, restSeconds: 0 },
        ],
      }) as unknown as UserExercise;

    // Bench removed, a third squat block added.
    await updateWorkoutPlan(1, "Plan", "", [
      {
        id: 2,
        name: "Legs",
        exercises: [block(100, 3), block(100, 8), block(100, 12)],
      },
    ]);

    const rows = sqlite
      .prepare(
        `SELECT id, exercise_id, exercise_order, sets, is_deleted FROM user_workout_exercises ORDER BY id`,
      )
      .all() as {
      id: number;
      exercise_id: number;
      exercise_order: number;
      sets: string;
      is_deleted: number;
    }[];
    expect(
      rows.map((r) => [
        r.id,
        r.exercise_id,
        r.exercise_order,
        JSON.parse(r.sets)[0]?.repsMin ?? null,
        r.is_deleted,
      ]),
    ).toEqual([
      // The first two squat rows keep their ids, in order.
      [1, 100, 0, 3, 0],
      // Bench was removed.
      [2, 200, 1, null, 1],
      [3, 100, 1, 8, 0],
      [4, 100, 2, 12, 0],
    ]);
  });
});
