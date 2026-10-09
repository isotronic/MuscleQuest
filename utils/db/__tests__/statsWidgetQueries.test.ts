// The stats widget queries against a real SQLite: training split by muscle,
// recent personal records and the rep totals of the workout summaries.
import {
  fetchPriorBests,
  fetchRecentPRs,
  fetchTrainingSplit,
  fetchWorkoutSummaries,
  type WorkoutStatsOptions,
} from "@/utils/db/workoutStats";
import { mergeSplitRows } from "@/utils/workoutStats";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

const NO_OPTIONS: WorkoutStatsOptions = {
  excludeWarmup: false,
  countUnilateralDouble: false,
  doubleWeightForPaired: false,
};

interface Set {
  weight?: number | null;
  reps?: number | null;
  time?: number | null;
  warmup?: boolean;
}

let nextWorkoutId = 1;
const workout = (
  localDate: string,
  exercises: { id: number; sets: Set[]; resolved?: string }[],
  { deleted = false } = {},
) => {
  const { sqlite } = mockDb;
  const id = nextWorkoutId++;
  sqlite
    .prepare(
      `INSERT INTO completed_workouts (id, date_completed, local_date, duration, is_deleted) VALUES (?, ?, ?, 3600, ?)`,
    )
    .run(id, `${localDate}T10:00:00.000Z`, localDate, deleted ? 1 : 0);
  for (const exercise of exercises) {
    const { lastInsertRowid } = sqlite
      .prepare(
        `INSERT INTO completed_exercises (completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?)`,
      )
      .run(id, exercise.id, exercise.resolved ?? null);
    exercise.sets.forEach((set, index) =>
      sqlite
        .prepare(
          `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, time, is_warmup) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(lastInsertRowid),
          index + 1,
          set.weight ?? null,
          set.reps ?? null,
          set.time ?? null,
          set.warmup ? 1 : 0,
        ),
    );
  }
  return id;
};

beforeEach(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  nextWorkoutId = 1;
  // Foreign key targets for the exercises below.
  mockDb.sqlite.exec(`
    INSERT INTO body_parts (body_part) VALUES ('chest'), ('upper legs'), ('waist'), ('upper arms');
    INSERT INTO muscles (muscle) VALUES ('pectorals'), ('quads'), ('abs'), ('biceps');
  `);
  const insert = mockDb.sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, body_part, target_muscle, secondary_muscles, tracking_type, is_unilateral, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run(
    1,
    "Bench Press",
    "chest",
    "pectorals",
    '["triceps","deltoids"]',
    "weight",
    0,
    0,
  );
  insert.run(2, "Lunge", "upper legs", "quads", '["glutes"]', "weight", 1, 0);
  insert.run(3, "Plank", "waist", "abs", "not json", "time", 0, 0);
  insert.run(4, "Old Curl", "upper arms", "biceps", "[]", "weight", 0, 1);
  insert.run(5, "Push-up", "chest", "pectorals", null, "reps", 0, 0);
});

afterEach(() => mockDb.sqlite.close());

describe("fetchTrainingSplit", () => {
  beforeEach(() => {
    workout("2026-03-02", [
      {
        id: 1,
        sets: [
          { weight: 20, reps: 10, warmup: true },
          { weight: 100, reps: 5 },
          { weight: 100, reps: 5 },
        ],
      },
      { id: 2, sets: [{ weight: 20, reps: 10 }] },
      { id: 3, sets: [{ time: 60 }] },
      { id: 4, sets: [{ weight: 10, reps: 10 }] },
    ]);
    workout("2026-03-04", [{ id: 1, sets: [{ weight: 100, reps: 5 }] }], {
      deleted: true,
    });
  });

  it("counts sets and volume per body part, without deleted exercises or workouts", async () => {
    const rows = await fetchTrainingSplit({}, "bodyPart", NO_OPTIONS);
    expect(mergeSplitRows(rows, "bodyPart", "sets")).toEqual({
      chest: 3,
      legs: 1,
      waist: 1,
    });
    expect(mergeSplitRows(rows, "bodyPart", "volume")).toEqual({
      chest: 20 * 10 + 1000,
      legs: 200,
    });
  });

  it("counts secondary muscles separately, folding their names into target muscles", async () => {
    const rows = await fetchTrainingSplit({}, "muscle", NO_OPTIONS);
    expect(mergeSplitRows(rows, "muscle", "sets")).toEqual({
      pectorals: 3,
      quads: 1,
      abs: 1,
    });
    // Invalid secondary JSON (the plank) is ignored.
    expect(mergeSplitRows(rows, "muscle", "sets", 0.5)).toEqual({
      pectorals: 3,
      quads: 1,
      abs: 1,
      triceps: 1.5,
      delts: 1.5,
      glutes: 0.5,
    });
  });

  it("leaves warm-ups out when asked and applies the doubling settings to volume", async () => {
    const rows = await fetchTrainingSplit({}, "bodyPart", {
      excludeWarmup: true,
      countUnilateralDouble: true,
      doubleWeightForPaired: false,
    });
    expect(mergeSplitRows(rows, "bodyPart", "sets").chest).toBe(2);
    expect(mergeSplitRows(rows, "bodyPart", "volume").legs).toBe(400);
  });

  it("keeps to the range", async () => {
    workout("2026-04-01", [{ id: 2, sets: [{ weight: 30, reps: 10 }] }]);
    const rows = await fetchTrainingSplit(
      { from: "2026-03-15" },
      "muscle",
      NO_OPTIONS,
    );
    expect(mergeSplitRows(rows, "muscle", "sets", 0.5)).toEqual({
      quads: 1,
      glutes: 0.5,
    });
  });
});

describe("fetchWorkoutSummaries rep_count", () => {
  it("adds up reps, doubling unilateral sets when set to", async () => {
    workout("2026-03-02", [
      {
        id: 1,
        sets: [
          { weight: 100, reps: 5 },
          { weight: 20, reps: 10, warmup: true },
        ],
      },
      { id: 2, sets: [{ weight: 20, reps: 8 }] },
      { id: 3, sets: [{ time: 60 }] },
    ]);
    const [plain] = await fetchWorkoutSummaries({}, NO_OPTIONS);
    expect(plain.rep_count).toBe(23);
    const [doubled] = await fetchWorkoutSummaries(
      {},
      { ...NO_OPTIONS, excludeWarmup: true, countUnilateralDouble: true },
    );
    expect(doubled.rep_count).toBe(21);
  });
});

describe("fetchRecentPRs", () => {
  const ALL = { trackedOnly: false, limit: 10 };

  it("reports sessions that beat every earlier session, newest first", async () => {
    workout("2026-01-05", [{ id: 1, sets: [{ weight: 100, reps: 5 }] }]);
    workout("2026-01-12", [{ id: 1, sets: [{ weight: 100, reps: 5 }] }]); // tie
    const second = workout("2026-01-19", [
      {
        id: 1,
        sets: [
          { weight: 100, reps: 6 },
          { weight: 105, reps: 5 },
        ],
      },
    ]);
    workout("2026-01-26", [{ id: 1, sets: [{ weight: 95, reps: 5 }] }]);
    const third = workout("2026-02-02", [
      {
        id: 1,
        sets: [
          { weight: 110, reps: 3 },
          { weight: 107.5, reps: 5 },
        ],
      },
    ]);

    const prs = await fetchRecentPRs({}, ALL);
    expect(prs.map((pr) => pr.completed_workout_id)).toEqual([third, second]);
    // The session's best set is reported, with the best before it.
    expect(prs[0]).toMatchObject({
      name: "Bench Press",
      weight: 107.5,
      reps: 5,
      local_date: "2026-02-02",
    });
    expect(prs[0].value).toBeCloseTo(107.5 * (1 + 5 / 30), 6);
    expect(prs[0].previous).toBeCloseTo(105 * (1 + 5 / 30), 6);
  });

  it("never counts the first session, warm-ups or deleted workouts", async () => {
    workout("2026-01-05", [{ id: 5, sets: [{ reps: 20 }] }]);
    workout("2026-01-12", [
      { id: 5, sets: [{ reps: 40, warmup: true }, { reps: 15 }] },
    ]);
    workout("2026-01-19", [{ id: 5, sets: [{ reps: 30 }] }], { deleted: true });
    expect(await fetchRecentPRs({}, ALL)).toEqual([]);
  });

  it("only compares sessions logged with the same tracking type", async () => {
    workout("2026-01-05", [
      { id: 5, sets: [{ weight: 20, reps: 10 }], resolved: "weight" },
    ]);
    workout("2026-01-12", [{ id: 5, sets: [{ reps: 12 }] }]);
    workout("2026-01-19", [{ id: 5, sets: [{ reps: 15 }] }]);
    const prs = await fetchRecentPRs({}, ALL);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({
      tracking_type: "reps",
      value: 15,
      previous: 12,
    });
  });

  it("keeps to the range, the limit and tracked exercises when asked", async () => {
    workout("2026-01-05", [
      { id: 1, sets: [{ weight: 100, reps: 5 }] },
      { id: 2, sets: [{ weight: 20, reps: 10 }] },
    ]);
    workout("2026-01-12", [
      { id: 1, sets: [{ weight: 105, reps: 5 }] },
      { id: 2, sets: [{ weight: 25, reps: 10 }] },
    ]);
    workout("2026-03-01", [{ id: 1, sets: [{ weight: 110, reps: 5 }] }]);

    expect(await fetchRecentPRs({ from: "2026-02-01" }, ALL)).toHaveLength(1);
    expect(
      await fetchRecentPRs({}, { trackedOnly: false, limit: 2 }),
    ).toHaveLength(2);

    mockDb.sqlite.exec(
      `INSERT INTO tracked_exercises (exercise_id) VALUES (2)`,
    );
    const tracked = await fetchRecentPRs({}, { trackedOnly: true, limit: 10 });
    expect(tracked.map((pr) => pr.name)).toEqual(["Lunge"]);
  });

  it("returns only one session's PRs, judged against everything before it", async () => {
    workout("2026-01-05", [
      { id: 1, sets: [{ weight: 100, reps: 5 }] },
      { id: 5, sets: [{ reps: 20 }] },
    ]);
    const earlier = workout("2026-01-12", [
      { id: 1, sets: [{ weight: 105, reps: 5 }] },
    ]);
    const session = workout("2026-01-19", [
      { id: 1, sets: [{ weight: 102.5, reps: 5 }] },
      { id: 5, sets: [{ reps: 25 }] },
    ]);

    const prs = await fetchRecentPRs(
      {},
      { ...ALL, completedWorkoutId: session },
    );
    // The bench press beat the first session but not the second.
    expect(prs.map((pr) => pr.name)).toEqual(["Push-up"]);
    expect(prs[0]).toMatchObject({ completed_workout_id: session, value: 25 });
    expect(
      await fetchRecentPRs({}, { ...ALL, completedWorkoutId: earlier }),
    ).toHaveLength(1);
  });
});

describe("fetchPriorBests", () => {
  it("takes the best working set per exercise and tracking type", async () => {
    workout("2026-01-05", [
      {
        id: 1,
        sets: [
          { weight: 140, reps: 5, warmup: true },
          { weight: 100, reps: 5 },
        ],
      },
      { id: 5, sets: [{ reps: 20 }] },
    ]);
    workout("2026-01-12", [
      { id: 1, sets: [{ weight: 105, reps: 3 }] },
      { id: 5, sets: [{ weight: 10, reps: 12 }], resolved: "weight" },
    ]);
    workout("2026-01-19", [{ id: 1, sets: [{ weight: 200, reps: 5 }] }], {
      deleted: true,
    });

    const bests = await fetchPriorBests([1, 5, 2]);
    const byKey = Object.fromEntries(
      bests.map((b) => [`${b.exercise_id}:${b.tracking_type}`, b.best]),
    );
    expect(Object.keys(byKey).sort()).toEqual([
      "1:weight",
      "5:reps",
      "5:weight",
    ]);
    // 100 x 5 beats 105 x 3 on estimated 1RM; the warm-up and the deleted
    // workout do not count.
    expect(byKey["1:weight"]).toBeCloseTo(100 * (1 + 5 / 30), 6);
    expect(byKey["5:reps"]).toBe(20);
    expect(byKey["5:weight"]).toBeCloseTo(10 * (1 + 12 / 30), 6);
  });

  it("leaves out deleted sets", async () => {
    const id = workout("2026-01-05", [
      { id: 5, sets: [{ reps: 20 }, { reps: 30 }] },
    ]);
    mockDb.sqlite.exec(
      `UPDATE completed_sets SET is_deleted = 1 WHERE reps = 30 AND completed_exercise_id IN (SELECT id FROM completed_exercises WHERE completed_workout_id = ${id})`,
    );
    expect(await fetchPriorBests([5])).toEqual([
      { exercise_id: 5, tracking_type: "reps", best: 20 },
    ]);
  });

  it("returns nothing for no exercises", async () => {
    expect(await fetchPriorBests([])).toEqual([]);
  });
});
