import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import {
  insertDefaultSettings,
  readWeekRule,
  saveWeekStart,
} from "@/utils/db/settings";
import { toLocalDateKey } from "@/utils/dates";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));
// A US device: pounds and Sunday weeks.
jest.mock("expo-localization", () => ({
  getLocales: () => [{ regionCode: "US", measurementSystem: "us" }],
  getCalendars: () => [{ firstWeekday: 1 }],
}));

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

  it("applies a change at once when asked, for a new install", async () => {
    await saveWeekStart(0, WEDNESDAY, { immediately: true });
    expect(await readWeekRule(created.db)).toEqual({ weekStartsOn: 0 });
    expect(setting("weekStartsOnFrom")).toBe("");
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

describe("insertDefaultSettings", () => {
  let created: ReturnType<typeof createNodeSqliteDb>;
  const all = () =>
    Object.fromEntries(
      (
        created.sqlite.prepare("SELECT key, value FROM settings").all() as {
          key: string;
          value: string;
        }[]
      ).map((row) => [row.key, row.value]),
    );

  beforeEach(async () => {
    created = createNodeSqliteDb();
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
  });

  it("gives a new install the device's units and week start, and setup", async () => {
    await insertDefaultSettings();
    const settings = all();
    expect(settings).toMatchObject({
      weightUnit: "lbs",
      distanceUnit: "ft",
      sizeUnit: "in",
      weightIncrement: "5",
      weekStartsOn: "0",
      setupDone: "pending",
    });
    // Unset until entered; the login screen writes loginShown.
    expect(settings.bodyWeight).toBeUndefined();
    expect(settings.loginShown).toBeUndefined();
  });

  it("leaves body weight out of volume until turned on", async () => {
    await insertDefaultSettings();
    expect(all().includeBodyWeightInVolume).toBe("false");
  });

  it("keeps body weight in volume once turned on", async () => {
    created.sqlite.exec(
      `INSERT INTO settings (key, value) VALUES ('includeBodyWeightInVolume', 'true')`,
    );
    await insertDefaultSettings();
    expect(all().includeBodyWeightInVolume).toBe("true");
  });

  it("keeps a new install's values on the next boot", async () => {
    await insertDefaultSettings();
    created.sqlite
      .prepare("UPDATE settings SET value = 'kg' WHERE key = 'weightUnit'")
      .run();
    await insertDefaultSettings();
    expect(all()).toMatchObject({ weightUnit: "kg", setupDone: "pending" });
  });

  it("never overwrites an older install's values and offers setup", async () => {
    created.sqlite.exec(`
      INSERT INTO settings (key, value) VALUES
        ('loginShown', 'false'), ('weightUnit', 'kg'), ('weightIncrement', '1'),
        ('bodyWeight', '82'), ('weeklyGoal', '4');
    `);
    await insertDefaultSettings();
    expect(all()).toMatchObject({
      loginShown: "false",
      weightUnit: "kg",
      weightIncrement: "1",
      bodyWeight: "82",
      weeklyGoal: "4",
      // Missing keys get the old fixed defaults, not the device's.
      distanceUnit: "m",
      sizeUnit: "cm",
      weekStartsOn: "1",
      setupDone: "offered",
    });
  });

  it("does not bring back a body weight the user removed", async () => {
    created.sqlite.exec(
      `INSERT INTO settings (key, value) VALUES ('loginShown', 'true')`,
    );
    await insertDefaultSettings();
    expect(all().bodyWeight).toBeUndefined();
  });
});
