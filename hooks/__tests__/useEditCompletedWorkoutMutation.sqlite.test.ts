import { useEditCompletedWorkoutMutation } from "../useEditCompletedWorkoutMutation";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { openDatabase } from "@/utils/database";
import { useMutation } from "@tanstack/react-query";
import type { CompletedWorkout } from "../useCompletedWorkoutsQuery";

jest.mock("@/utils/database", () => ({ openDatabase: jest.fn() }));
jest.mock("@/utils/progressionRecompute", () => ({
  refreshProgressionAfterHistoryChange: jest.fn(),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

type Exercises = CompletedWorkout["exercises"];
type Row = Record<string, unknown>;

const set = (
  set_id: number,
  set_number: number,
  values: { weight?: number | null; reps?: number | null } = {},
) => ({
  set_id,
  set_number,
  weight: values.weight === undefined ? 137.8 : values.weight,
  reps: values.reps === undefined ? 8 : values.reps,
  time: null,
  distance: null,
  is_warmup: false,
  set_duration: null,
});

/**
 * Two exercises, as the edit screen loads them for a lbs user: 62.5 kg reads
 * as 137.8 lbs, which converts back to 62.505 kg, so rewriting an untouched
 * set would change it.
 */
const original = (): Exercises => [
  {
    completed_exercise_id: 1,
    exercise_id: 100,
    exercise_name: "Bench Press",
    exercise_tracking_type: "weight",
    sets: [set(11, 1), set(12, 2), set(13, 3, { weight: null })],
  },
  {
    completed_exercise_id: 2,
    exercise_id: 200,
    exercise_name: "Squat",
    exercise_tracking_type: "weight",
    sets: [set(21, 1)],
  },
];

describe("useEditCompletedWorkoutMutation against SQLite", () => {
  let sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"];
  let mutationFn: (vars: {
    original: Exercises;
    edited: Exercises;
  }) => Promise<void>;

  const rows = (table: string): Row[] =>
    sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[];

  beforeEach(() => {
    const created = createNodeSqliteDb();
    sqlite = created.sqlite;
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
    sqlite.exec(`
      CREATE TABLE completed_exercises (
        id INTEGER PRIMARY KEY, exercise_id INTEGER, resolved_tracking_type TEXT
      );
      CREATE TABLE completed_sets (
        id INTEGER PRIMARY KEY, completed_exercise_id INTEGER,
        set_number INTEGER, weight REAL, reps INTEGER, time INTEGER,
        distance REAL
      );
      INSERT INTO completed_exercises VALUES (1, 100, 'weight'), (2, 200, NULL);
      INSERT INTO completed_sets VALUES
        (11, 1, 1, 62.5, 8, NULL, NULL),
        (12, 1, 2, 62.5, 8, NULL, NULL),
        (13, 1, 3, NULL, 8, NULL, NULL),
        (21, 2, 1, 62.5, 8, NULL, NULL);
    `);
    (useMutation as jest.Mock).mockImplementation((args) => {
      mutationFn = args.mutationFn;
      return { mutate: jest.fn() };
    });
    useEditCompletedWorkoutMutation(42, "lbs", "m");
  });

  it("leaves every untouched row exactly as it was", async () => {
    const before = rows("completed_sets");
    const exercisesBefore = rows("completed_exercises");
    const edited = original();
    edited[0].sets[1].reps = 10;

    await mutationFn({ original: original(), edited });

    const after = rows("completed_sets");
    expect(after.filter((r) => r.id !== 12)).toEqual(
      before.filter((r) => r.id !== 12),
    );
    expect(rows("completed_exercises")).toEqual(exercisesBefore);
  });

  it("writes only the field that changed on an edited set", async () => {
    const edited = original();
    edited[0].sets[1].reps = 10;

    await mutationFn({ original: original(), edited });

    expect(rows("completed_sets").find((r) => r.id === 12)).toEqual({
      id: 12,
      completed_exercise_id: 1,
      set_number: 2,
      weight: 62.5,
      reps: 10,
      time: null,
      distance: null,
    });
  });

  it("keeps a missing weight missing when another field changes", async () => {
    const edited = original();
    edited[0].sets[2].reps = 5;

    await mutationFn({ original: original(), edited });

    const row = rows("completed_sets").find((r) => r.id === 13)!;
    expect(row.weight).toBeNull();
    expect(row.reps).toBe(5);
  });

  it("stores a cleared weight as null, not 0", async () => {
    const edited = original();
    edited[1].sets[0].weight = null;

    await mutationFn({ original: original(), edited });

    expect(rows("completed_sets").find((r) => r.id === 21)!.weight).toBeNull();
  });

  it("converts an edited weight to kg", async () => {
    const edited = original();
    edited[1].sets[0].weight = 220;

    await mutationFn({ original: original(), edited });

    expect(rows("completed_sets").find((r) => r.id === 21)!.weight).toBeCloseTo(
      99.79,
      2,
    );
  });

  it("updates the exercise row only when the exercise was swapped", async () => {
    const edited = original();
    edited[1].exercise_id = 300;
    edited[1].exercise_tracking_type = "reps";

    await mutationFn({ original: original(), edited });

    expect(rows("completed_exercises")).toEqual([
      { id: 1, exercise_id: 100, resolved_tracking_type: "weight" },
      { id: 2, exercise_id: 300, resolved_tracking_type: "reps" },
    ]);
  });
});
