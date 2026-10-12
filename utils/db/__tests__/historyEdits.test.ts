import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import {
  applyHistoryEdits,
  FutureWorkoutDateError,
} from "@/utils/db/historyEdits";
import { fetchCompletedWorkoutById } from "@/utils/db/workouts";
import { buildHistoryEditOps, EditableWorkout } from "@/utils/historyEditOps";
import { parseDbTimestamp, toLocalDateKey } from "@/utils/dates";
import { weekStartKeyFor } from "@/utils/trainingWeek";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

type Row = Record<string, unknown>;

// A Wednesday evening, built as a local moment so the training day is the
// same in every timezone the suite runs under.
const WEDNESDAY = new Date(2026, 8, 30, 18, 0, 0);

describe("applyHistoryEdits", () => {
  let sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"];

  const rows = (sql: string, ...params: any[]): Row[] =>
    sqlite.prepare(sql).all(...params) as Row[];
  const sets = (completedExerciseId: number) =>
    rows(
      `SELECT id, set_number, weight, reps, is_warmup, is_drop_set, is_to_failure, note
       FROM completed_sets WHERE completed_exercise_id = ? ORDER BY set_number`,
      completedExerciseId,
    );

  beforeEach(async () => {
    const created = createNodeSqliteDb();
    sqlite = created.sqlite;
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
    sqlite
      .prepare(
        `INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed)
         VALUES (1, ?, ?, 3600, 4)`,
      )
      .run(WEDNESDAY.toISOString(), toLocalDateKey(WEDNESDAY));
    sqlite.exec(`
      INSERT INTO exercises (exercise_id, name, tracking_type)
      VALUES (100, 'Bench Press', 'weight'), (200, 'Squat', 'weight'),
             (300, 'Plank', 'time');
      INSERT INTO completed_exercises (id, completed_workout_id, exercise_id, resolved_tracking_type)
      VALUES (10, 1, 100, 'weight'), (20, 1, 200, 'weight');
      INSERT INTO completed_sets (id, completed_exercise_id, set_number, weight, reps)
      VALUES (11, 10, 1, 62.5, 8), (12, 10, 2, 62.5, 8), (13, 10, 3, NULL, 8),
             (21, 20, 1, 100, 5);
    `);
  });

  /** The workout as the editor loads it for a lbs user. */
  const load = async (): Promise<EditableWorkout> => {
    const workout = await fetchCompletedWorkoutById(1, "lbs", "m");
    return {
      exercises: workout.exercises,
      completedAt: parseDbTimestamp(workout.date_completed),
      durationSeconds: workout.duration,
      notes: workout.notes ?? null,
    };
  };

  const save = async (edit: (workout: EditableWorkout) => EditableWorkout) => {
    const original = await load();
    const edited = edit(structuredClone(original));
    return applyHistoryEdits(
      1,
      buildHistoryEditOps(original, edited, "lbs", "m"),
    );
  };

  it("leaves untouched rows exactly as they were", async () => {
    const before = rows(`SELECT * FROM completed_sets ORDER BY id`);
    await save((w) => {
      w.exercises[0].sets[1].reps = 10;
      return w;
    });
    const after = rows(`SELECT * FROM completed_sets ORDER BY id`);
    expect(after.filter((r) => r.id !== 12)).toEqual(
      before.filter((r) => r.id !== 12),
    );
    expect(after.find((r) => r.id === 12)).toMatchObject({
      weight: 62.5,
      reps: 10,
    });
  });

  it("stores a cleared weight as null and converts an edited one to kg", async () => {
    await save((w) => {
      w.exercises[0].sets[0].weight = null;
      w.exercises[1].sets[0].weight = 220;
      return w;
    });
    expect(sets(10)[0].weight).toBeNull();
    expect(sets(20)[0].weight).toBeCloseTo(99.79, 2);
  });

  it("adds a set after the last one and counts it in the session total", async () => {
    await save((w) => {
      w.exercises[1].sets.push({
        ...w.exercises[1].sets[0],
        set_id: -1,
        set_number: 2,
        reps: 3,
      });
      return w;
    });
    expect(sets(20)).toEqual([
      expect.objectContaining({ id: 21, set_number: 1, reps: 5 }),
      expect.objectContaining({ set_number: 2, reps: 3 }),
    ]);
    expect(
      rows(`SELECT total_sets_completed FROM completed_workouts`)[0],
    ).toEqual({ total_sets_completed: 5 });
  });

  it("removes a set and renumbers the rest", async () => {
    await save((w) => {
      w.exercises[0].sets.splice(0, 1);
      return w;
    });
    expect(sets(10).map((s) => [s.id, s.set_number])).toEqual([
      [12, 1],
      [13, 2],
    ]);
    expect(
      rows(`SELECT total_sets_completed FROM completed_workouts`)[0],
    ).toEqual({ total_sets_completed: 3 });
  });

  it("updates set flags and notes", async () => {
    await save((w) => {
      w.exercises[0].sets[0].is_warmup = true;
      w.exercises[0].sets[2].is_to_failure = true;
      w.exercises[0].sets[1].note = "  grindy ";
      return w;
    });
    expect(sets(10)).toEqual([
      expect.objectContaining({ id: 11, is_warmup: 1, is_to_failure: 0 }),
      expect.objectContaining({ id: 12, is_warmup: 0, note: "grindy" }),
      expect.objectContaining({ id: 13, is_warmup: 0, is_to_failure: 1 }),
    ]);
  });

  it("removes an exercise together with its sets", async () => {
    await save((w) => {
      w.exercises.splice(1, 1);
      return w;
    });
    expect(rows(`SELECT id FROM completed_exercises`)).toEqual([{ id: 10 }]);
    expect(sets(20)).toEqual([]);
  });

  it("adds an exercise with its sets", async () => {
    await save((w) => {
      w.exercises.push({
        completed_exercise_id: -1,
        exercise_id: 300,
        exercise_name: "Plank",
        exercise_tracking_type: "time",
        sets: [
          {
            set_id: -2,
            set_number: 1,
            weight: null,
            reps: null,
            time: 60,
            distance: null,
            is_warmup: false,
            set_duration: null,
          },
        ],
      });
      return w;
    });
    const added = rows(
      `SELECT ce.exercise_id, ce.resolved_tracking_type, cs.set_number, cs.time
       FROM completed_exercises ce JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
       WHERE ce.exercise_id = 300`,
    );
    expect(added).toEqual([
      {
        exercise_id: 300,
        resolved_tracking_type: "time",
        set_number: 1,
        time: 60,
      },
    ]);
  });

  it("writes the new instant and its training day when the date moves", async () => {
    const moved = new Date(2026, 8, 26, 9, 30);
    const result = await save((w) => ({ ...w, completedAt: moved }));
    expect(
      rows(`SELECT date_completed, local_date FROM completed_workouts`),
    ).toEqual([
      {
        date_completed: moved.toISOString(),
        local_date: toLocalDateKey(moved),
      },
    ]);
    expect(result).toEqual({
      previousLocalDate: toLocalDateKey(WEDNESDAY),
      localDate: toLocalDateKey(moved),
      passedSessionIds: [],
    });
  });

  it("recounts both weeks when a workout moves to the week before", async () => {
    const thisWeek = weekStartKeyFor(toLocalDateKey(WEDNESDAY));
    // The Sunday before: the last day of the previous week.
    const sunday = new Date(2026, 8, 27, 10, 0);
    const lastWeek = weekStartKeyFor(toLocalDateKey(sunday));
    expect(lastWeek).not.toBe(thisWeek);
    sqlite
      .prepare(
        `INSERT INTO weekly_completions (week_start, goal, completed, goal_reached)
         VALUES (?, 1, 1, 1), (?, 2, 1, 0)`,
      )
      .run(thisWeek, lastWeek);
    // A second workout earlier last week, so last week then has two days.
    sqlite
      .prepare(
        `INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed)
         VALUES (2, ?, ?, 600, 1)`,
      )
      .run(
        new Date(2026, 8, 22, 18).toISOString(),
        toLocalDateKey(new Date(2026, 8, 22, 18)),
      );

    await save((w) => ({ ...w, completedAt: sunday }));

    expect(
      rows(
        `SELECT week_start, goal, completed, goal_reached FROM weekly_completions ORDER BY week_start`,
      ),
    ).toEqual([
      { week_start: lastWeek, goal: 2, completed: 2, goal_reached: 1 },
      { week_start: thisWeek, goal: 1, completed: 0, goal_reached: 0 },
    ]);
  });

  it("names the sessions of the same workout it moved past", async () => {
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'Plan');
      INSERT INTO user_workouts (id, plan_id, name) VALUES (5, 1, 'Push');
      UPDATE completed_workouts SET workout_id = 5 WHERE id = 1;
    `);
    const insert = sqlite.prepare(
      `INSERT INTO completed_workouts (id, workout_id, date_completed, local_date, duration, total_sets_completed)
       VALUES (?, ?, ?, ?, 600, 1)`,
    );
    const at = (day: number) => new Date(2026, 8, day, 18);
    // Between the old and new dates: 2 (same workout) and 3 (another one).
    insert.run(2, 5, at(28).toISOString(), toLocalDateKey(at(28)));
    insert.run(3, null, at(28).toISOString(), toLocalDateKey(at(28)));
    // Before the new date, so not passed.
    insert.run(4, 5, at(20).toISOString(), toLocalDateKey(at(20)));

    const result = await save((w) => ({ ...w, completedAt: at(25) }));
    expect(result.passedSessionIds).toEqual([2]);

    const unmoved = await save((w) => ({ ...w, durationSeconds: 60 }));
    expect(unmoved.passedSessionIds).toEqual([]);
  });

  it("rejects a finish time in the future and changes nothing", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const before = rows(`SELECT * FROM completed_workouts`);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await expect(
      save((w) => {
        w.exercises[0].sets[0].reps = 1;
        return { ...w, completedAt: tomorrow };
      }),
    ).rejects.toBeInstanceOf(FutureWorkoutDateError);
    expect(rows(`SELECT * FROM completed_workouts`)).toEqual(before);
    expect(sets(10)[0].reps).toBe(8);
  });

  it("updates duration and session note", async () => {
    await save((w) => ({ ...w, durationSeconds: 1800, notes: "Felt good" }));
    expect(rows(`SELECT duration, notes FROM completed_workouts`)).toEqual([
      { duration: 1800, notes: "Felt good" },
    ]);
  });
});
