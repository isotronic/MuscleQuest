// setMetric must score a set exactly as progressionMetricSql does, or the PR
// badge in a session and the PRs on the summary and stats would disagree.
import { setMetric, type MetricSet } from "@/utils/prMetric";
import { progressionMetricSql } from "@/utils/db/progressionMetricSql";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

describe("setMetric", () => {
  it("scores weight sets by estimated 1RM", () => {
    expect(setMetric({ weight: 100, reps: 5 }, "weight")).toBeCloseTo(
      100 * (1 + 5 / 30),
      9,
    );
    // Unknown types score as weight, like the SQL's ELSE branch.
    expect(setMetric({ weight: 100, reps: 5 }, null)).toBeCloseTo(
      100 * (1 + 5 / 30),
      9,
    );
  });

  it("always doubles paired weights", () => {
    expect(
      setMetric({ weight: 20, reps: 10 }, "weight", { doubleWeight: true }),
    ).toBeCloseTo(40 * (1 + 10 / 30), 9);
  });

  it("scores assisted sets by body weight minus the assistance", () => {
    expect(
      setMetric({ weight: 20, reps: 8 }, "assisted", { bodyWeight: 80 }),
    ).toBeCloseTo(60 * (1 + 8 / 30), 9);
  });

  it("scores reps, time and distance by their own value", () => {
    expect(setMetric({ reps: 12 }, "reps")).toBe(12);
    expect(setMetric({ time: 90 }, "time")).toBe(90);
    expect(setMetric({ distance: 2500 }, "distance")).toBe(2500);
    expect(setMetric({}, "reps")).toBe(0);
  });
});

describe("setMetric and progressionMetricSql", () => {
  let mockDb: ReturnType<typeof createNodeSqliteDb>;

  beforeEach(async () => {
    mockDb = createNodeSqliteDb();
    await runMigrations(mockDb.db);
    mockDb.sqlite.exec(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', '82.5')`,
    );
  });

  afterEach(() => mockDb.sqlite.close());

  const fixtures: {
    type: string | null;
    double: boolean;
    set: MetricSet;
  }[] = [
    { type: "weight", double: false, set: { weight: 102.5, reps: 5 } },
    { type: "weight", double: true, set: { weight: 22.5, reps: 12 } },
    { type: "weight", double: false, set: { weight: null, reps: 8 } },
    { type: "assisted", double: false, set: { weight: 25, reps: 6 } },
    { type: "assisted", double: true, set: { weight: 0, reps: 10 } },
    { type: "reps", double: false, set: { reps: 17 } },
    { type: "time", double: false, set: { time: 75 } },
    { type: "distance", double: false, set: { distance: 1609.3 } },
    { type: "other", double: true, set: { weight: 50, reps: 3 } },
  ];

  it.each(fixtures)(
    "agrees on $type (double $double)",
    ({ type, double, set }) => {
      const row = mockDb.sqlite
        .prepare(
          `SELECT ${progressionMetricSql("?")} AS value
         FROM (SELECT ? AS double_weight) e,
           (SELECT ? AS weight, ? AS reps, ? AS time, ? AS distance) cs`,
        )
        .get(
          type,
          double ? 1 : 0,
          set.weight ?? null,
          set.reps ?? null,
          set.time ?? null,
          set.distance ?? null,
        ) as { value: number };
      expect(
        setMetric(set, type, { doubleWeight: double, bodyWeight: 82.5 }),
      ).toBeCloseTo(row.value, 9);
    },
  );
});
