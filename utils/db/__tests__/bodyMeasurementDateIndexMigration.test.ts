import { getSchemaVersion, runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { bodyWeightAtSql } from "@/utils/db/bodyWeightAtSql";

describe("body measurement date index migration", () => {
  it("lets the body weight lookup use an index instead of a scan", async () => {
    const { sqlite, db } = createNodeSqliteDb();
    await runMigrations(db);

    const plan = sqlite
      .prepare(
        `EXPLAIN QUERY PLAN SELECT ${bodyWeightAtSql("'2026-03-01T00:00:00.000Z'")}`,
      )
      .all() as { detail: string }[];
    const details = plan.map((row) => row.detail).join("\n");

    expect(details).toMatch(/SEARCH bm USING INDEX idx_body_measurements_date/);
    expect(await getSchemaVersion(db)).toBeGreaterThanOrEqual(6);
    sqlite.close();
  });
});
