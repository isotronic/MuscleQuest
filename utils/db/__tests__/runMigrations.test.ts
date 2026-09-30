import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import type { Migration } from "@/utils/db/migrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

const tableNames = (sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"]) =>
  (
    sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all() as { name: string }[]
  ).map((row) => row.name);

const createTable = (name: string) =>
  jest.fn(async (db: any) => {
    await db.execAsync(`CREATE TABLE ${name} (id INTEGER PRIMARY KEY)`);
  });

describe("runMigrations", () => {
  it("runs every migration in order on a new database", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    const order: number[] = [];
    const migrations: Migration[] = [1, 2, 3].map((version) => ({
      version,
      name: `m${version}`,
      up: async () => {
        order.push(version);
      },
    }));

    expect(await runMigrations(db, migrations)).toBe(3);

    expect(order).toEqual([1, 2, 3]);
    expect(await getSchemaVersion(db)).toBe(3);
    sqlite.close();
  });

  it("does nothing on a second run", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    const migrations: Migration[] = [
      { version: 1, name: "a", up: createTable("a") },
      { version: 2, name: "b", up: createTable("b") },
    ];

    await runMigrations(db, migrations);
    await runMigrations(db, migrations);

    expect(migrations[0].up).toHaveBeenCalledTimes(1);
    expect(migrations[1].up).toHaveBeenCalledTimes(1);
    sqlite.close();
  });

  it("only runs migrations above the current version", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    sqlite.exec("PRAGMA user_version = 1");
    const migrations: Migration[] = [
      { version: 1, name: "a", up: createTable("a") },
      { version: 2, name: "b", up: createTable("b") },
    ];

    await runMigrations(db, migrations);

    expect(migrations[0].up).not.toHaveBeenCalled();
    expect(tableNames(sqlite)).toEqual(["b"]);
    expect(await getSchemaVersion(db)).toBe(2);
    sqlite.close();
  });

  it("rolls a failing migration back and leaves the version unchanged", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    const migrations: Migration[] = [
      { version: 1, name: "a", up: createTable("a") },
      {
        version: 2,
        name: "broken",
        up: async (txn) => {
          await txn.execAsync(`CREATE TABLE half_done (id INTEGER)`);
          throw new Error("migration 2 failed");
        },
      },
      { version: 3, name: "c", up: createTable("c") },
    ];

    await expect(runMigrations(db, migrations)).rejects.toThrow(
      "migration 2 failed",
    );

    // Migration 1 stays committed, 2 left no trace, 3 never ran.
    expect(tableNames(sqlite)).toEqual(["a"]);
    expect(await getSchemaVersion(db)).toBe(1);
    expect(migrations[2].up).not.toHaveBeenCalled();
    sqlite.close();
  });

  it("leaves a database newer than the bundle untouched", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    sqlite.exec("PRAGMA user_version = 9");
    const migrations: Migration[] = [
      { version: 1, name: "a", up: createTable("a") },
    ];

    expect(await runMigrations(db, migrations)).toBe(9);

    expect(migrations[0].up).not.toHaveBeenCalled();
    expect(await getSchemaVersion(db)).toBe(9);
    sqlite.close();
  });
});
