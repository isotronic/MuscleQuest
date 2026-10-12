import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import { saveSetupChanges } from "@/utils/db/setup";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));
jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));

describe("saveSetupChanges", () => {
  let created: ReturnType<typeof createNodeSqliteDb>;
  const setting = (key: string) =>
    (
      created.sqlite
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key) as { value: string } | undefined
    )?.value;

  beforeEach(async () => {
    created = createNodeSqliteDb();
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
    created.sqlite.exec(`
      INSERT INTO settings (key, value) VALUES
        ('weightUnit', 'kg'), ('weekStartsOn', '1'), ('setupDone', 'pending');
    `);
  });

  const write = {
    settings: [{ key: "weightUnit", value: "lbs" }],
    weekStartsOn: 0 as const,
    weekStartImmediately: true,
    bodyWeightKg: 80,
  };

  it("writes every change, logs the body weight and finishes setup", async () => {
    await saveSetupChanges(write);
    expect(setting("weightUnit")).toBe("lbs");
    expect(setting("weekStartsOn")).toBe("0");
    expect(setting("bodyWeight")).toBe("80");
    expect(setting("setupDone")).toBe("done");
    expect(
      created.sqlite.prepare("SELECT body_weight FROM body_measurements").all(),
    ).toEqual([{ body_weight: 80 }]);
  });

  it("writes nothing when one part fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    created.sqlite.exec("DROP TABLE body_measurements");
    await expect(saveSetupChanges(write)).rejects.toThrow();
    expect(setting("weightUnit")).toBe("kg");
    expect(setting("weekStartsOn")).toBe("1");
    expect(setting("setupDone")).toBe("pending");
  });
});
