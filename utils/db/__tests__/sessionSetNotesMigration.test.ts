import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import { migrations } from "@/utils/db/migrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

const upToV3 = migrations.filter((m) => m.version <= 3);

type Column = { name: string; type: string; notnull: number };

const column = (
  sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"],
  table: string,
  name: string,
) =>
  (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Column[]).find(
    (c) => c.name === name,
  );

describe("session and set notes migration", () => {
  it("adds nullable note columns on a fresh database", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db);

    expect(column(sqlite, "completed_workouts", "notes")).toMatchObject({
      type: "TEXT",
      notnull: 0,
    });
    expect(column(sqlite, "completed_sets", "note")).toMatchObject({
      type: "TEXT",
      notnull: 0,
    });
    expect(await getSchemaVersion(db)).toBeGreaterThanOrEqual(4);
    sqlite.close();
  });

  it("keeps existing history with NULL notes when upgrading", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db, upToV3);
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      INSERT INTO completed_workouts (id, plan_id, workout_id, date_completed, duration)
      VALUES (1, NULL, NULL, '2026-01-01T10:00:00.000Z', 3600);
      INSERT INTO completed_exercises (id, completed_workout_id, exercise_id)
      VALUES (1, 1, 1);
      INSERT INTO completed_sets (id, completed_exercise_id, set_number, weight, reps)
      VALUES (1, 1, 1, 100, 5);
    `);

    await runMigrations(db);

    expect(
      sqlite.prepare(`SELECT notes FROM completed_workouts`).all(),
    ).toEqual([{ notes: null }]);
    expect(sqlite.prepare(`SELECT note FROM completed_sets`).all()).toEqual([
      { note: null },
    ]);
    sqlite.close();
  });
});
