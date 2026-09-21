// initUserDataDBIndexes.test.ts
//
// The workout-history joins depend on these indexes; without them SQLite
// builds an automatic covering index on every history query. Runs the real
// initUserDataDB against an in-memory SQLite so the assertion is on what the
// database actually ends up holding, not on the SQL text we happened to send.
import { openDatabase } from "@/utils/database";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { DatabaseSync } from "node:sqlite";

type IndexRow = { name: string };

describe("initUserDataDB indexes", () => {
  let sqlite: DatabaseSync;

  const indexesOn = (table: string): string[] =>
    (sqlite.prepare(`PRAGMA index_list(${table})`).all() as IndexRow[])
      .map((row) => row.name)
      .sort();

  beforeAll(async () => {
    sqlite = new DatabaseSync(":memory:");

    // expo-sqlite's async surface, backed by the real engine. ALTER TABLE
    // migrations for columns the fresh schema already has throw "duplicate
    // column name"; initUserDataDB guards those with PRAGMA table_info, so a
    // throw here is a genuine failure and is left to propagate.
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
  });

  afterAll(() => {
    sqlite.close();
  });

  it.each([
    ["completed_workouts", "idx_cw_date"],
    ["completed_workouts", "idx_cw_workout"],
    ["completed_exercises", "idx_ce_workout"],
    ["completed_exercises", "idx_ce_exercise"],
    ["completed_sets", "idx_cs_exercise"],
    ["user_workout_exercises", "idx_uwe_ex_workout"],
  ])("creates %s.%s", (table, index) => {
    expect(indexesOn(table)).toContain(index);
  });

  it("keeps the existing body-measurement indexes", () => {
    expect(indexesOn("body_measurement_values")).toEqual(
      expect.arrayContaining(["idx_bmv_entry", "idx_bmv_metric"]),
    );
  });

  it("is idempotent, so a second boot adds no duplicates", async () => {
    const before = indexesOn("completed_workouts");

    await initUserDataDB();

    expect(indexesOn("completed_workouts")).toEqual(before);
  });

  it("plans the history join with indexes instead of a table scan", () => {
    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT cw.id, ce.id, cs.id
         FROM completed_workouts cw
         LEFT JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
         LEFT JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
         WHERE cw.is_deleted = FALSE
         ORDER BY cw.date_completed DESC`,
      )
      .all()
      .map((row: any) => row.detail)
      .join("\n");

    expect(plan).toContain("idx_ce_workout");
    expect(plan).toContain("idx_cs_exercise");
    expect(plan).not.toContain("AUTOMATIC COVERING INDEX");
  });
});
