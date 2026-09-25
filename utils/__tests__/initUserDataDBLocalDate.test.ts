// initUserDataDBLocalDate.test.ts
//
// local_date is the device-local calendar day a workout or measurement belongs
// to. Existing rows predate the column, so initUserDataDB backfills them from
// their UTC instant. Runs the real initUserDataDB against an in-memory SQLite
// so the assertions are on what the database ends up holding.
import { openDatabase } from "@/utils/database";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { parseDbTimestamp, toLocalDateKey } from "@/utils/dates";
import { DatabaseSync } from "node:sqlite";

describe("initUserDataDB local_date backfill", () => {
  let sqlite: DatabaseSync;

  const columnsOn = (table: string): string[] =>
    (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
      .map((r) => r.name)
      .sort();

  const indexesOn = (table: string): string[] =>
    (sqlite.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[])
      .map((r) => r.name)
      .sort();

  const workouts = () =>
    sqlite
      .prepare(
        `SELECT id, date_completed, local_date FROM completed_workouts ORDER BY id`,
      )
      .all() as { id: number; date_completed: string; local_date: string }[];

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

    // First boot builds the schema.
    await initUserDataDB();

    // Seed rows as earlier app versions wrote them, then rewind the backfill
    // flag so the next boot has work to do.
    sqlite.exec(`
      INSERT INTO completed_workouts (id, date_completed, duration, total_sets_completed)
      VALUES
        (1, '2026-08-13 22:30:00', 600, 5),
        (2, '2026-01-05 03:15:00', 600, 5),
        (3, '2026-03-02T09:00:00.000Z', 600, 5);
      INSERT INTO body_measurement_entries (id, recorded_at)
      VALUES (1, '2026-08-13 22:30:00'), (2, '2026-08-14T07:00:00.000Z');
      DELETE FROM settings WHERE key = 'local_date_backfill_v1';
      UPDATE completed_workouts SET local_date = NULL;
      UPDATE body_measurement_entries SET local_date = NULL;
    `);

    await initUserDataDB();
  });

  afterAll(() => sqlite.close());

  it("adds local_date to completed_workouts", () => {
    expect(columnsOn("completed_workouts")).toContain("local_date");
  });

  it("adds local_date to body_measurement_entries", () => {
    expect(columnsOn("body_measurement_entries")).toContain("local_date");
  });

  it("indexes completed_workouts.local_date", () => {
    expect(indexesOn("completed_workouts")).toContain("idx_cw_local_date");
  });

  it("derives each workout's local_date from its UTC instant", () => {
    for (const row of workouts()) {
      expect(row.local_date).toBe(
        toLocalDateKey(parseDbTimestamp(row.date_completed)),
      );
    }
  });

  it("attributes a late-evening UTC row to the local day, not the UTC day", () => {
    // '2026-08-13 22:30:00' is UTC. East of UTC+2 the training day is the 14th.
    const expected = toLocalDateKey(new Date(Date.UTC(2026, 7, 13, 22, 30)));
    expect(workouts()[0].local_date).toBe(expected);
  });

  it("normalises legacy date_completed values to ISO with an explicit Z", () => {
    for (const row of workouts()) {
      expect(row.date_completed).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
  });

  it("does not move the instant it normalises", () => {
    expect(workouts()[0].date_completed).toBe(
      new Date(Date.UTC(2026, 7, 13, 22, 30)).toISOString(),
    );
    expect(workouts()[2].date_completed).toBe("2026-03-02T09:00:00.000Z");
  });

  it("backfills body measurement entries too", () => {
    const rows = sqlite
      .prepare(
        `SELECT recorded_at, local_date FROM body_measurement_entries ORDER BY id`,
      )
      .all() as { recorded_at: string; local_date: string }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.local_date).toBe(
        toLocalDateKey(parseDbTimestamp(row.recorded_at)),
      );
    }
  });

  it("is a no-op on the next boot", async () => {
    const before = workouts();

    await initUserDataDB();

    expect(workouts()).toEqual(before);
  });
});
