// DATE(cw.date_completed) is the UTC calendar day. A workout finished late in
// the evening east of UTC, or one logged before the user travelled, belongs to
// a different local day, and these queries report that day to the user: chart
// buckets, PR dates and the recent-session list. They must group and range
// filter on local_date, the stored training day, instead.
//
// The range filters have a second problem: stored instants are ISO with a 'T'
// while DATETIME('now', ...) returns a space-separated value, and 'T' sorts
// above ' ', so rows sharing the boundary's date slip past the comparison.
import { openDatabase } from "@/utils/database";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { useExerciseDetailQuery } from "../useExerciseDetailQuery";
import { useTrackedExercisesQuery } from "../useTrackedExercisesQuery";
import { useQuery } from "@tanstack/react-query";
import { toLocalDateKey } from "@/utils/dates";
import { DatabaseSync } from "node:sqlite";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

const dayKeyAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateKey(d);
};

describe("time range filters against real SQLite", () => {
  let sqlite: DatabaseSync;

  beforeAll(async () => {
    sqlite = new DatabaseSync(":memory:");
    const adapter: any = {
      execAsync: async (sql: string) => sqlite.exec(sql),
      runAsync: async (sql: string, params: any[] = []) =>
        sqlite.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: any[] = []) =>
        sqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: any[] = []) =>
        sqlite.prepare(sql).get(...params) ?? null,
      withExclusiveTransactionAsync: async (fn: (txn: any) => Promise<void>) =>
        fn(adapter),
      closeAsync: async () => {},
    };
    (openDatabase as jest.Mock).mockResolvedValue(adapter);
    await initUserDataDB();

    sqlite.exec(`
      INSERT INTO exercises (exercise_id, name, tracking_type, is_deleted)
      VALUES (1, 'Bench Press', 'weight', FALSE);
      INSERT INTO tracked_exercises (exercise_id) VALUES (1);
    `);

    // `instantDay` is the UTC day the instant falls on; `trainingDay` is the
    // day the user actually trained. They differ for a late-evening session
    // east of UTC and for anything logged in another timezone.
    const addWorkout = (
      id: number,
      trainingDaysAgo: number,
      weight: number,
      instantDaysAgo = trainingDaysAgo,
    ) => {
      sqlite
        .prepare(
          `INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed, is_deleted)
           VALUES (?, ?, ?, 600, 1, FALSE)`,
        )
        .run(
          id,
          `${dayKeyAgo(instantDaysAgo)}T01:00:00.000Z`,
          dayKeyAgo(trainingDaysAgo),
        );
      sqlite
        .prepare(
          `INSERT INTO completed_exercises (id, completed_workout_id, exercise_id) VALUES (?, ?, 1)`,
        )
        .run(id, id);
      sqlite
        .prepare(
          `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps)
           VALUES (?, 1, ?, 5)`,
        )
        .run(id, weight);
    };
    // Trained on the 5th day back, but the instant lands on the 4th in UTC.
    addWorkout(1, 5, 100, 4);
    addWorkout(2, 200, 60);
  });

  afterAll(() => sqlite.close());

  const runQuery = async (hookCall: () => void) => {
    hookCall();
    const call = (useQuery as jest.Mock).mock.calls.at(-1)![0];
    return await call.queryFn();
  };

  const detailFor = (range: string) =>
    runQuery(() =>
      useExerciseDetailQuery(1, range, "kg", false, false, false, false),
    ) as Promise<any>;

  it("reports a session under its training day, not its UTC day", async () => {
    const detail = await detailFor("0");
    const days = detail.trackedExercise.completed_sets.map(
      (s: any) => s.date_completed,
    );

    expect(days).toContain(dayKeyAgo(5));
    expect(days).not.toContain(dayKeyAgo(4));
  });

  it("dates a PR by the training day", async () => {
    const detail = await detailFor("0");

    expect(detail.topPRSets[0].date_completed).toBe(dayKeyAgo(5));
  });

  it("dates a recent session by the training day", async () => {
    const detail = await detailFor("0");

    expect(detail.recentSessions[0].date_completed).toBe(dayKeyAgo(5));
  });

  it("drops sessions older than the selected range", async () => {
    const detail = await detailFor("30");
    const days = detail.trackedExercise.completed_sets.map(
      (s: any) => s.date_completed,
    );

    expect(days).toContain(dayKeyAgo(5));
    expect(days).not.toContain(dayKeyAgo(200));
  });

  it("useTrackedExercisesQuery does not let a set with no training day past the range", async () => {
    // `OR ... IS NULL` exists for tracked exercises with no workouts at all
    // (the LEFT JOIN miss). A real set whose local_date has not been filled
    // yet must not ride in on it.
    sqlite.exec(`
      INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed, is_deleted)
      VALUES (3, '2025-01-01T12:00:00.000Z', NULL, 600, 1, FALSE);
      INSERT INTO completed_exercises (id, completed_workout_id, exercise_id) VALUES (3, 3, 1);
      INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps) VALUES (3, 1, 200, 5);
    `);
    try {
      const tracked: any = await runQuery(() =>
        useTrackedExercisesQuery("30", false, false, false, false),
      );
      const days = tracked[0].completed_sets.map((s: any) => s.date_completed);

      expect(days).not.toContain(null);
      expect(days).toContain(dayKeyAgo(5));
    } finally {
      sqlite.exec(`
        DELETE FROM completed_sets WHERE completed_exercise_id = 3;
        DELETE FROM completed_exercises WHERE id = 3;
        DELETE FROM completed_workouts WHERE id = 3;
      `);
    }
  });

  it("useTrackedExercisesQuery reports the training day and honours the range", async () => {
    const tracked: any = await runQuery(() =>
      useTrackedExercisesQuery("30", false, false, false, false),
    );
    const days = tracked[0].completed_sets.map((s: any) => s.date_completed);

    expect(days).toContain(dayKeyAgo(5));
    expect(days).not.toContain(dayKeyAgo(4));
    expect(days).not.toContain(dayKeyAgo(200));
  });
});
