import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import { readWeekRule, saveWeekStart } from "@/utils/db/settings";
import { toLocalDateKey } from "@/utils/dates";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

// Wednesday 14 October 2026, a local moment.
const WEDNESDAY = new Date(2026, 9, 14, 12);
const key = (date: number) => toLocalDateKey(new Date(2026, 9, date, 12));

describe("saveWeekStart", () => {
  let created: ReturnType<typeof createNodeSqliteDb>;
  const setting = (k: string) =>
    (
      created.sqlite
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(k) as { value: string } | undefined
    )?.value;

  beforeEach(async () => {
    created = createNodeSqliteDb();
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
  });

  it("starts Sunday weeks after the running Monday week", async () => {
    await saveWeekStart(0, WEDNESDAY);
    expect(setting("weekStartsOn")).toBe("0");
    expect(setting("weekStartsOnPrevious")).toBe("1");
    expect(setting("weekStartsOnFrom")).toBe(key(18));
    expect(await readWeekRule(created.db)).toEqual({
      weekStartsOn: 0,
      previous: 1,
      from: key(18),
    });
  });

  it("clears the transition when the change is undone before it starts", async () => {
    await saveWeekStart(0, WEDNESDAY);
    await saveWeekStart(1, WEDNESDAY);
    expect(setting("weekStartsOn")).toBe("1");
    expect(setting("weekStartsOnPrevious")).toBe("");
    expect(setting("weekStartsOnFrom")).toBe("");
    expect(await readWeekRule(created.db)).toEqual({ weekStartsOn: 1 });
  });
});
