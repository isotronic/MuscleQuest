// The demo seed against a real (in-memory) database: it writes through the
// app's own data functions, so these run the actual SQL.
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { readDemoSeedRecord, removeDemoData, seedDemoData } from "../seed";
import { history } from "../history";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));
jest.mock("@/utils/database", () => jest.requireActual("@/utils/database"));
// The About screen section; its settings rows need Lingui and the theme.
jest.mock("../DemoDataSection", () => ({ DemoDataSection: () => null }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { appVariant: "development" } } },
}));

// A Wednesday: Monday and Tuesday of this week are done, Upper 2 is today.
const NOW = new Date(2026, 9, 14, 12, 0);

const LIBRARY: Record<number, [string, string, string, string | null]> = {
  // appExerciseId: [name, equipment, target muscle, tracking type]
  11: ["Barbell Bench Press", "barbell", "pectorals", null],
  353: ["Dumbbell Incline Bench Press", "dumbbell", "pectorals", null],
  153: ["Cable Bar Lateral Pulldown", "cable", "lats", null],
  14: ["Barbell Bent Over Row", "barbell", "upper back", null],
  498: ["Dumbbell Seated Shoulder Press", "dumbbell", "delts", null],
  567: ["Ez-Bar Curl", "ez barbell", "biceps", null],
  473: ["Dumbbell Seated Bench Extension", "dumbbell", "triceps", null],
  33: ["Barbell Full Squat", "barbell", "glutes", null],
  58: ["Barbell Lying Lifting (On Hip)", "barbell", "glutes", null],
  656: ["Lever Leg Extension", "leverage machine", "quads", null],
  685: ["Lever Seated Leg Curl", "leverage machine", "hamstrings", null],
  695: ["Lever Standing Calf Raise", "leverage machine", "calves", null],
  133: ["Barbell Standing Wide Military Press", "barbell", "delts", null],
  4: ["Assisted Pull-up", "leverage machine", "lats", "assisted"],
  681: ["Lever Seated Fly", "leverage machine", "pectorals", null],
  172: ["Cable Hammer Curl (With Rope)", "cable", "biceps", null],
  211: ["Cable Overhead Triceps Extension", "cable", "triceps", null],
  218: ["Cable Pushdown", "cable", "triceps", null],
  20: ["Barbell Deadlift", "barbell", "glutes", null],
  710: ["Sled Leg Press", "sled machine", "glutes", null],
  657: ["Lever Lying Leg Curl", "leverage machine", "hamstrings", null],
  684: ["Lever Seated Hip Adduction", "leverage machine", "adductors", null],
  675: ["Lever Seated Calf Press", "leverage machine", "calves", null],
};

// The library copied into userData.db, plus some of the user's own data the
// seed must leave as it was: an active plan, a pinned bench press, an old
// weekly goal row and a weekly goal of 3.
const seedExistingData = () => {
  const { sqlite } = mockDb;
  const values = Object.values(LIBRARY);
  const insertOnce = (table: string, column: string, items: string[]) => {
    for (const item of new Set(items)) {
      sqlite
        .prepare(`INSERT OR IGNORE INTO ${table} (${column}) VALUES (?)`)
        .run(item);
    }
  };
  insertOnce(
    "muscles",
    "muscle",
    values.map((v) => v[2]),
  );
  insertOnce(
    "equipment_list",
    "equipment",
    values.map((v) => v[1]),
  );
  const insert = sqlite.prepare(
    `INSERT INTO exercises (app_exercise_id, name, equipment, target_muscle, tracking_type) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const [appId, [name, equipment, muscle, tracking]] of Object.entries(
    LIBRARY,
  )) {
    insert.run(Number(appId), name, equipment, muscle, tracking);
  }
  sqlite.exec(`
    INSERT INTO user_plans (id, app_plan_id, name, image_url, is_active)
      VALUES (1, 2, '4-Day Upper/Lower Split', 'https://example.com/plan.jpg', 0);
    INSERT INTO user_plans (id, name, is_active) VALUES (2, 'My own plan', 1);
    INSERT INTO settings (key, value) VALUES ('weeklyGoal', '3');
    INSERT INTO settings (key, value) VALUES ('weightUnit', 'lbs');
    INSERT INTO weekly_completions (week_start, goal, completed, goal_reached)
      VALUES ('2025-01-06', 3, 3, 1);
  `);
  const bench = sqlite
    .prepare(`SELECT exercise_id FROM exercises WHERE app_exercise_id = 11`)
    .get() as { exercise_id: number };
  sqlite
    .prepare(`INSERT INTO tracked_exercises (exercise_id) VALUES (?)`)
    .run(bench.exercise_id);
};

/** Every row of every table, to compare before and after. */
const snapshot = () => {
  const { sqlite } = mockDb;
  const tables = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      sqlite
        // A key/value table, and INSERT OR REPLACE (updateSettings) gives a
        // replaced row a new rowid: compared by key.
        .prepare(
          `SELECT * FROM "${name}" ORDER BY ${name === "settings" ? "key" : "rowid"}`,
        )
        .all()
        .filter(
          (row: any) => !(name === "settings" && row.key === "demo_seed"),
        ),
    ]),
  );
};

const count = (sql: string, ...params: (string | number)[]) =>
  (mockDb.sqlite.prepare(sql).get(...params) as { n: number }).n;

beforeEach(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  seedExistingData();
});

it("seeds eight weeks of plan workouts with this week two days in", async () => {
  const record = await seedDemoData(NOW);

  // 31 sessions in the fixture, minus Wednesday to Sunday of this week.
  expect(record.completedWorkoutIds).toHaveLength(29);
  expect(
    count(
      `SELECT COUNT(*) AS n FROM completed_workouts WHERE local_date >= '2026-10-12'`,
    ),
  ).toBe(2);
  expect(
    count(`SELECT COUNT(*) AS n FROM completed_workouts WHERE is_deload = 1`),
  ).toBe(4);

  const plan = mockDb.sqlite
    .prepare(`SELECT * FROM user_plans WHERE is_active = 1`)
    .all() as { id: number; name: string; image_url: string }[];
  expect(plan).toEqual([
    expect.objectContaining({
      id: record.planId,
      name: "4-Day Upper/Lower Split",
      image_url: "https://example.com/plan.jpg",
    }),
  ]);
  expect(
    count(
      `SELECT COUNT(*) AS n FROM plan_schedule WHERE plan_id = ?`,
      record.planId!,
    ),
  ).toBe(4);
  expect(
    count(
      `SELECT COUNT(*) AS n FROM user_workout_exercises WHERE superset_group_id = 'demo-arms'`,
    ),
  ).toBe(2);

  const settings = Object.fromEntries(
    (
      mockDb.sqlite.prepare(`SELECT key, value FROM settings`).all() as {
        key: string;
        value: string;
      }[]
    ).map((r) => [r.key, r.value]),
  );
  expect(settings).toMatchObject({
    weeklyGoal: "4",
    weekStartsOn: "1",
    weightUnit: "kg",
    sizeUnit: "cm",
    adaptive_progression_enabled: "1",
    setupDone: "done",
    bodyWeight: "82",
  });
});

it("sets a bench press PR in the last two weeks and suggests the next step", async () => {
  const record = await seedDemoData(NOW);
  const rows = mockDb.sqlite
    .prepare(
      `SELECT MAX(cs.weight) AS kg, cw.local_date AS day
       FROM completed_sets cs
       JOIN completed_exercises ce ON ce.id = cs.completed_exercise_id
       JOIN completed_workouts cw ON cw.id = ce.completed_workout_id
       JOIN exercises e ON e.exercise_id = ce.exercise_id
       WHERE e.app_exercise_id = 11 AND cs.is_warmup = 0
       GROUP BY cw.id ORDER BY cw.date_completed`,
    )
    .all() as { kg: number; day: string }[];
  expect(rows.at(-1)).toEqual({ kg: 82.5, day: "2026-10-12" });
  expect(Math.max(...rows.slice(0, -1).map((r) => r.kg))).toBe(80);

  const suggestion = (appExerciseId: number) =>
    mockDb.sqlite
      .prepare(
        `SELECT eps.suggestion_action, eps.suggested_weight, eps.recovery_rating
         FROM exercise_progression_state eps
         JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
         JOIN exercises e ON e.exercise_id = uwe.exercise_id
         WHERE e.app_exercise_id = ? AND uwe.workout_id IN (${record.workoutIds.join(",")})`,
      )
      .get(appExerciseId);
  expect(suggestion(11)).toEqual({
    suggestion_action: "increase_load",
    suggested_weight: 85,
    recovery_rating: "fresh",
  });
  // Today's workout opens with a +2.5 kg suggestion on the military press.
  expect(suggestion(133)).toEqual({
    suggestion_action: "increase_load",
    suggested_weight: 50,
    recovery_rating: "fresh",
  });
});

it("is a no-op when run again", async () => {
  const first = await seedDemoData(NOW);
  const afterFirst = snapshot();

  const second = await seedDemoData(new Date(2026, 9, 16, 9, 0));

  expect(second).toEqual(first);
  expect(snapshot()).toEqual(afterFirst);
});

it("removes exactly what it added and restores what it changed", async () => {
  const before = snapshot();

  await seedDemoData(NOW);
  expect(snapshot()).not.toEqual(before);

  expect(await removeDemoData()).toBe(true);
  expect(snapshot()).toEqual(before);
  expect(await readDemoSeedRecord()).toMatchObject({ status: "removed" });

  // Removed stays removed: a later seed call is what loads it again.
  expect(await removeDemoData()).toBe(false);
});

it("does not seed a removed record again by itself", async () => {
  await seedDemoData(NOW);
  await removeDemoData();
  const afterRemoval = snapshot();

  const { runStartupSeed } = jest.requireActual("../index");
  expect(await runStartupSeed()).toEqual({ status: "removed" });
  expect(snapshot()).toEqual(afterRemoval);
});

it("has a load for every exercise, week and working set", () => {
  for (const workout of history.plan.workouts) {
    for (const ex of workout.exercises) {
      const loads = history.progressions[ex.key];
      expect(Array.isArray(loads) && loads.length).toBe(8);
      for (const [, reps] of loads as [number, number[]][]) {
        expect(reps).toHaveLength(ex.working);
      }
    }
  }
});

it("does not reactivate the previous plan once it has been deleted", async () => {
  await seedDemoData(NOW);
  mockDb.sqlite.exec(`UPDATE user_plans SET is_deleted = 1 WHERE id = 2`);

  await removeDemoData();

  expect(
    count(`SELECT COUNT(*) AS n FROM user_plans WHERE is_active = 1`),
  ).toBe(0);
});
