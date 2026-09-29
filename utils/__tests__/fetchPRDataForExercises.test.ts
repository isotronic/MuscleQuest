// fetchPRDataForExercises.test.ts
//
// The all-time PR date is the earliest session whose best set matches the PR.
// Runs the real query against an in-memory SQLite, because the answer depends
// on which rows the SQL window keeps, not on how the JS maps them.
import { fetchPRDataForExercises } from "@/utils/database";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { KG_PER_LB, displayToKg, roundCanonical } from "@/utils/units";
import { DatabaseSync } from "node:sqlite";

// Run the real database.ts; only the native driver underneath is replaced.
jest.unmock("@/utils/database");
// Break circular imports, as database.test.ts does.
jest.mock("@/hooks/useCompletedWorkoutsQuery", () => ({}));
jest.mock("@/store/workoutStore", () => ({}));

let mockSqlite: DatabaseSync;

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => {
    const adapter: any = {
      execAsync: async (sql: string) => mockSqlite.exec(sql),
      runAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).get(...params) ?? null,
      withExclusiveTransactionAsync: async (fn: (txn: any) => Promise<void>) =>
        fn(adapter),
      closeAsync: async () => {},
    };
    return adapter;
  }),
}));

const EXERCISE_ID = 7;
let nextWorkoutId = 1;

// One session of `sets` identical working sets of `kg` x5 on `day`.
const logSession = (day: string, kg: number, sets: number) => {
  const workoutId = nextWorkoutId++;
  mockSqlite
    .prepare(
      `INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed, is_deleted)
       VALUES (?, ?, ?, 600, ?, 0)`,
    )
    .run(workoutId, `${day}T18:00:00.000Z`, day, sets);
  const exercise = mockSqlite
    .prepare(
      `INSERT INTO completed_exercises (completed_workout_id, exercise_id, is_deleted)
       VALUES (?, ?, 0)`,
    )
    .run(workoutId, EXERCISE_ID);
  for (let n = 1; n <= sets; n++) {
    mockSqlite
      .prepare(
        `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup, is_deleted)
         VALUES (?, ?, ?, 5, 0, 0)`,
      )
      .run(exercise.lastInsertRowid, n, kg);
  }
};

beforeEach(async () => {
  mockSqlite = new DatabaseSync(":memory:");
  nextWorkoutId = 1;
  await initUserDataDB();
  mockSqlite
    .prepare(
      `INSERT INTO exercises (exercise_id, name, tracking_type) VALUES (?, 'Bench Press', 'weight')`,
    )
    .run(EXERCISE_ID);
});

afterEach(() => mockSqlite.close());

describe("fetchPRDataForExercises against real SQLite", () => {
  it("keeps the first date when 225 lbs is saved in several sessions", async () => {
    const saved = roundCanonical(displayToKg(225, "lbs"));
    logSession("2026-09-01", saved, 3);
    logSession("2026-09-08", saved, 3);
    logSession("2026-09-15", saved, 3);

    const [pr] = await fetchPRDataForExercises([EXERCISE_ID]);

    expect(pr.all_time_pr_date).toBe("2026-09-01");
  });

  it("keeps the legacy date when more than five rounded sets tie it", async () => {
    // 135 lbs saved before rounding, then in two sessions after. Rounding lands
    // the new rows a fraction of a gram heavier, so all six sort above the
    // legacy sets and fill the five top-set rows on their own.
    const legacy = 135 * KG_PER_LB;
    const rounded = roundCanonical(displayToKg(135, "lbs"));
    expect(rounded).toBeGreaterThan(legacy);
    logSession("2026-09-01", legacy, 3);
    logSession("2026-09-08", rounded, 3);
    logSession("2026-09-15", rounded, 3);

    const [pr] = await fetchPRDataForExercises([EXERCISE_ID]);

    expect(pr.all_time_pr_date).toBe("2026-09-01");
    expect(pr.top_sets).toHaveLength(5);
  });

  it("moves the date when a later session is genuinely heavier", async () => {
    logSession("2026-09-01", roundCanonical(displayToKg(135, "lbs")), 3);
    logSession("2026-09-08", roundCanonical(displayToKg(135.5, "lbs")), 1);

    const [pr] = await fetchPRDataForExercises([EXERCISE_ID]);

    expect(pr.all_time_pr_date).toBe("2026-09-08");
  });
});
