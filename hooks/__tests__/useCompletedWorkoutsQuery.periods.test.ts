// The previous-period comparison used `date_completed BETWEEN <date> AND <date>`
// against full datetimes, so any workout logged after midnight on the end day
// sorted above the bound and was silently dropped (BR-08). These tests run the
// real SQL against a real SQLite so the assertion is on rows returned, not on
// the SQL text.
import { openDatabase } from "@/utils/database";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { usePreviousPeriodWorkoutsQuery } from "../useCompletedWorkoutsQuery";
import { useQuery } from "@tanstack/react-query";
import { toLocalDateKey } from "@/utils/dates";
import { DatabaseSync } from "node:sqlite";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

const dayKeyAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateKey(d);
};

describe("usePreviousPeriodWorkoutsQuery against real SQLite", () => {
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

    // The current 7-day period is [today-7, today], so the previous one is
    // [today-15, today-8]. Seed a workout on each edge of that window, plus one
    // just outside it, each finished late in the day.
    const insert = sqlite.prepare(
      `INSERT INTO completed_workouts (id, date_completed, local_date, duration, total_sets_completed, is_deleted)
       VALUES (?, ?, ?, 600, 5, FALSE)`,
    );
    insert.run(1, `${dayKeyAgo(8)}T23:45:00.000Z`, dayKeyAgo(8));
    insert.run(2, `${dayKeyAgo(15)}T23:45:00.000Z`, dayKeyAgo(15));
    insert.run(3, `${dayKeyAgo(7)}T23:45:00.000Z`, dayKeyAgo(7));
    insert.run(4, `${dayKeyAgo(16)}T23:45:00.000Z`, dayKeyAgo(16));
  });

  afterAll(() => sqlite.close());

  // The queryFn the hook last handed react-query.
  const lastQueryFn = () =>
    (useQuery as jest.Mock).mock.calls.at(-1)![0].queryFn as () => Promise<
      { id: number }[]
    >;

  it("counts a workout logged on the final day of the previous period", async () => {
    usePreviousPeriodWorkoutsQuery("kg", "m", 7);
    const ids = (await lastQueryFn()()).map((w) => w.id);

    expect(ids).toContain(1);
  });

  it("counts a workout logged on the first day of the previous period", async () => {
    usePreviousPeriodWorkoutsQuery("kg", "m", 7);
    const ids = (await lastQueryFn()()).map((w) => w.id);

    expect(ids).toContain(2);
  });

  it("excludes the days on either side of the previous period", async () => {
    usePreviousPeriodWorkoutsQuery("kg", "m", 7);
    const ids = (await lastQueryFn()()).map((w) => w.id);

    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
  });
});
