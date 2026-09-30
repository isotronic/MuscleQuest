// The baseline migration has to bring any database that predates versioned
// migrations to the same schema a fresh install gets. The fixtures are the
// schemas real releases created: each is the sqlite_master dump of
// `git show <commit>:utils/initUserDataDB.ts` run against an empty database.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { LATEST_SCHEMA_VERSION, migrations } from "@/utils/db/migrations";
import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

type Sqlite = ReturnType<typeof createNodeSqliteDb>["sqlite"];

const FIXTURE_DIR = join(__dirname, "fixtures");
const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".sql"));

// Column order and the CREATE text differ between a table created whole and
// one built up by ALTER TABLE, so compare what the columns and indexes are.
const describeSchema = (sqlite: Sqlite) => {
  const tables = (
    sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[]
  ).map((row) => row.name);

  return Object.fromEntries(
    tables.map((table) => {
      const columns = (
        sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }[]
      )
        .map(
          (c) =>
            `${c.name} ${c.type} notnull=${c.notnull} default=${c.dflt_value} pk=${c.pk}`,
        )
        .sort();
      const indexes = (
        sqlite.prepare(`PRAGMA index_list(${table})`).all() as {
          name: string;
        }[]
      )
        .map((i) => i.name)
        .sort();
      return [table, { columns, indexes }];
    }),
  );
};

// Only the baseline is written to re-run over a schema that already has
// everything it creates; later migrations run exactly once.
const baselineOnly = migrations.filter((m) => m.version === 1);

const freshSchema = async () => {
  const { sqlite, db } = createNodeSqliteDb();
  await runMigrations(db);
  const schema = describeSchema(sqlite);
  sqlite.close();
  return schema;
};

describe("baseline migration", () => {
  it("has fixtures for at least three historical schemas", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
  });

  it("takes a fresh database to the latest version", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db);
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    sqlite.close();
  });

  it.each(fixtures)(
    "brings %s to the same schema as a fresh install",
    async (fixture) => {
      const { sqlite, db } = createNodeSqliteDb();
      sqlite.exec(readFileSync(join(FIXTURE_DIR, fixture), "utf8"));
      expect(await getSchemaVersion(db)).toBe(0);

      await runMigrations(db);

      expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
      expect(describeSchema(sqlite)).toEqual(await freshSchema());
      sqlite.close();
    },
  );

  // A backup taken by a bundle that predates user_version has the full
  // schema but version 0, so the baseline runs over a complete database.
  it("is safe to run again over an up-to-date schema", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db, baselineOnly);
    sqlite.exec("PRAGMA user_version = 0");

    await runMigrations(db);

    expect(describeSchema(sqlite)).toEqual(await freshSchema());
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    sqlite.close();
  });

  it("keeps existing rows when upgrading the oldest schema", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    sqlite.exec(readFileSync(join(FIXTURE_DIR, fixtures[0]), "utf8"));
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'My plan');
      INSERT INTO user_workouts (id, plan_id, name) VALUES (1, 1, 'Day 1');
      INSERT INTO completed_workouts (id, plan_id, workout_id, date_completed, duration, total_sets_completed)
      VALUES (1, 1, 1, '2024-12-20 18:30:00', 3600, 12);
    `);

    await runMigrations(db);

    expect(
      sqlite.prepare(`SELECT name FROM user_plans WHERE id = 1`).get(),
    ).toEqual({ name: "My plan" });
    expect(
      sqlite
        .prepare(`SELECT duration, is_deload FROM completed_workouts`)
        .all(),
    ).toEqual([{ duration: 3600, is_deload: 0 }]);
    sqlite.close();
  });

  it("orders existing workouts by id when it adds workout_order", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    sqlite.exec(readFileSync(join(FIXTURE_DIR, fixtures[0]), "utf8"));
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'My plan');
      INSERT INTO user_workouts (id, plan_id, name)
      VALUES (4, 1, 'Day 1'), (7, 1, 'Day 2'), (9, 1, 'Day 3');
    `);

    await runMigrations(db);

    expect(
      sqlite
        .prepare(`SELECT id, workout_order FROM user_workouts ORDER BY id`)
        .all(),
    ).toEqual([
      { id: 4, workout_order: 4 },
      { id: 7, workout_order: 7 },
      { id: 9, workout_order: 9 },
    ]);
    sqlite.close();
  });

  it("leaves workout_order alone when the column already exists", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db, baselineOnly);
    sqlite.exec(`
      INSERT INTO user_workouts (id, name, workout_order) VALUES (5, 'Day 1', 2);
      PRAGMA user_version = 0;
    `);

    await runMigrations(db);

    expect(
      sqlite.prepare(`SELECT workout_order FROM user_workouts`).get(),
    ).toEqual({ workout_order: 2 });
    sqlite.close();
  });
});
