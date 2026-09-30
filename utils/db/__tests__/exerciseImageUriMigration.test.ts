import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import { migrations } from "@/utils/db/migrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

const baselineOnly = migrations.filter((m) => m.version === 1);

describe("exercise image_uri migration", () => {
  it("adds a nullable image_uri column to exercises", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db);

    const columns = sqlite.prepare(`PRAGMA table_info(exercises)`).all() as {
      name: string;
      type: string;
      notnull: number;
    }[];
    expect(columns.find((c) => c.name === "image_uri")).toMatchObject({
      type: "TEXT",
      notnull: 0,
    });
    expect(await getSchemaVersion(db)).toBeGreaterThanOrEqual(2);
    sqlite.close();
  });

  it("points custom exercises at the photo they already have on disk", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db, baselineOnly);
    sqlite.exec(`
      INSERT INTO exercises (exercise_id, app_exercise_id, name, local_animated_uri)
      VALUES (1, NULL, 'Custom with photo', 'file:///doc/photo.jpg'),
             (2, NULL, 'Custom without photo', ''),
             (3, 77, 'Library', 'file:///doc/exercise_3.webp');
    `);

    await runMigrations(db);

    const rows = sqlite
      .prepare(
        `SELECT exercise_id, image_uri FROM exercises ORDER BY exercise_id`,
      )
      .all();
    expect(rows).toEqual([
      { exercise_id: 1, image_uri: "file:///doc/photo.jpg" },
      { exercise_id: 2, image_uri: null },
      { exercise_id: 3, image_uri: null },
    ]);
    sqlite.close();
  });
});
