import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import { migrations } from "@/utils/db/migrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

const beforeMetres = migrations.filter((m) => m.version < 3);

type Db = ReturnType<typeof createNodeSqliteDb>;

async function seed(distanceUnit: string | null): Promise<Db> {
  const created = createNodeSqliteDb();
  await runMigrations(created.db, beforeMetres);
  // The fixture plans have no parent workout or exercise rows.
  created.sqlite.exec(`PRAGMA foreign_keys = OFF`);
  if (distanceUnit !== null) {
    created.sqlite
      .prepare(`INSERT INTO settings (key, value) VALUES ('distanceUnit', ?)`)
      .run(distanceUnit);
  }
  const insert = created.sqlite.prepare(
    `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets) VALUES (?, 1, 1, ?)`,
  );
  insert.run(
    1,
    JSON.stringify([
      { repsMin: 0, distance: 1312.34, restMinutes: 1 },
      { distance: 0 },
      { repsMin: 8 },
    ]),
  );
  insert.run(2, "not json");
  insert.run(3, JSON.stringify([{ repsMin: 8, repsMax: 12 }]));
  insert.run(4, null);
  return created;
}

const setsOf = ({ sqlite }: Db, id: number) =>
  (
    sqlite
      .prepare(`SELECT sets FROM user_workout_exercises WHERE id = ?`)
      .get(id) as { sets: string | null }
  ).sets;

describe("plan distance metres migration", () => {
  it("converts a feet user's plan targets to metres", async () => {
    const db = await seed("ft");

    await runMigrations(db.db);

    expect(JSON.parse(setsOf(db, 1)!)).toEqual([
      { repsMin: 0, distance: 400.001, restMinutes: 1 },
      { distance: 0 },
      { repsMin: 8 },
    ]);
    expect(await getSchemaVersion(db.db)).toBeGreaterThanOrEqual(3);
    db.sqlite.close();
  });

  it("leaves rows it cannot parse or that hold no distance untouched", async () => {
    const db = await seed("ft");
    const untouched = [2, 3, 4].map((id) => setsOf(db, id));

    await runMigrations(db.db);

    expect([2, 3, 4].map((id) => setsOf(db, id))).toEqual(untouched);
    db.sqlite.close();
  });

  it.each(["m", null])(
    "leaves plans alone when the distance unit is %s",
    async (unit) => {
      const db = await seed(unit);
      const before = setsOf(db, 1);

      await runMigrations(db.db);

      expect(setsOf(db, 1)).toBe(before);
      expect(await getSchemaVersion(db.db)).toBeGreaterThanOrEqual(3);
      db.sqlite.close();
    },
  );

  it("converts only once", async () => {
    const db = await seed("ft");

    await runMigrations(db.db);
    await runMigrations(db.db);

    expect(JSON.parse(setsOf(db, 1)!)[0].distance).toBe(400.001);
    db.sqlite.close();
  });
});
