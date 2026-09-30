// Runs the real query against an in-memory SQLite.
import { countCompletedWorkouts } from "@/utils/db/workoutStats";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { DatabaseSync } from "node:sqlite";

jest.unmock("@/utils/database");
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

const log = (instant: string, deleted = 0) =>
  mockSqlite
    .prepare(
      `INSERT INTO completed_workouts (date_completed, local_date, duration, total_sets_completed, is_deleted)
       VALUES (?, ?, 600, 3, ?)`,
    )
    .run(instant, instant.slice(0, 10), deleted);

beforeEach(async () => {
  mockSqlite = new DatabaseSync(":memory:");
  await initUserDataDB();
  log("2026-08-01T18:00:00.000Z");
  log("2026-08-20T18:00:00.000Z");
  log("2026-09-10T18:00:00.000Z");
  log("2026-09-12T18:00:00.000Z", 1);
});

afterEach(() => mockSqlite.close());

describe("countCompletedWorkouts", () => {
  it("counts workouts that are not deleted", async () => {
    expect(await countCompletedWorkouts()).toBe(3);
  });

  it("counts only workouts completed after the given instant", async () => {
    expect(await countCompletedWorkouts(new Date("2026-08-10T00:00:00Z"))).toBe(
      2,
    );
  });
});
