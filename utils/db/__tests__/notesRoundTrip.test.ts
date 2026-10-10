import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase as openConnection } from "@/utils/db/connection";
import { openDatabase as openFromBarrel } from "@/utils/database";
import {
  fetchCompletedWorkoutById,
  saveCompletedWorkout,
  updateCompletedWorkoutNotes,
} from "@/utils/db/workouts";
import {
  useGlobalExerciseHistoryForSessionQuery,
  useWorkoutSessionHistoryQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));
jest.mock("@/utils/database", () => ({ openDatabase: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

const set = (set_number: number, note?: string) => ({
  set_number,
  weight: 100,
  reps: 5,
  time: null,
  distance: null,
  note,
});

describe("session and set notes round trip", () => {
  let sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"];
  let completedId: number;

  beforeEach(async () => {
    const created = createNodeSqliteDb();
    sqlite = created.sqlite;
    await runMigrations(created.db);
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'Plan');
      INSERT INTO user_workouts (id, plan_id, name) VALUES (2, 1, 'Push');
      INSERT INTO exercises (exercise_id, name, tracking_type)
      VALUES (100, 'Bench Press', 'weight');
    `);
    (openConnection as jest.Mock).mockResolvedValue(created.db);
    (openFromBarrel as jest.Mock).mockResolvedValue(created.db);

    completedId = await saveCompletedWorkout(
      1,
      2,
      600,
      3,
      false,
      [
        {
          exercise_id: 100,
          sets: [set(1), set(2, "felt shoulder on rep 6"), set(3, " ")],
        },
      ],
      undefined,
      "Slept badly",
    );
  });

  afterEach(() => sqlite.close());

  it("stores blank notes as NULL", () => {
    expect(
      sqlite.prepare(`SELECT note FROM completed_sets ORDER BY id`).all(),
    ).toEqual([
      { note: null },
      { note: "felt shoulder on rep 6" },
      { note: null },
    ]);
  });

  it("reads them back for history details and the summary", async () => {
    const workout = await fetchCompletedWorkoutById(completedId);

    expect(workout.notes).toBe("Slept badly");
    expect(workout.exercises[0].sets.map((s) => s.note)).toEqual([
      null,
      "felt shoulder on rep 6",
      null,
    ]);
  });

  it("reads them back for the next session's history", async () => {
    useWorkoutSessionHistoryQuery(2, "kg", "m");
    useGlobalExerciseHistoryForSessionQuery([100], "kg", "m");
    const [session, global] = (useQuery as jest.Mock).mock.calls.map(
      ([options]) => options.queryFn,
    );

    for (const queryFn of [session, global]) {
      const [workout] = await queryFn();
      expect(workout.notes).toBe("Slept badly");
      expect(workout.exercises[0].sets[1].note).toBe("felt shoulder on rep 6");
    }
  });

  it("updates the session note after the save, blank as NULL", async () => {
    await updateCompletedWorkoutNotes(completedId, "  Felt strong after all ");
    expect((await fetchCompletedWorkoutById(completedId)).notes).toBe(
      "Felt strong after all",
    );

    await updateCompletedWorkoutNotes(completedId, "   ");
    expect(
      sqlite
        .prepare(`SELECT notes FROM completed_workouts WHERE id = ?`)
        .get(completedId),
    ).toEqual({ notes: null });
  });
});
