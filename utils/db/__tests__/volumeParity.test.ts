// Volume is defined once in JS (utils/volume.ts) and once in SQL (volumeSql in
// utils/db/workoutStats.ts). These tests run one fixture with every tracking
// type through both, with body weight taken at the time of each workout.
import {
  fetchTrainingSplit,
  fetchWorkoutSummaries,
  type WorkoutStatsOptions,
} from "@/utils/db/workoutStats";
import { mergeSplitRows } from "@/utils/workoutStats";
import { completedWorkoutVolume, setVolume } from "@/utils/volume";
import { fetchCompletedWorkoutById } from "@/utils/db/workouts";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

interface FixtureExercise {
  id: number;
  tracking_type: string;
  is_unilateral: number;
  double_weight: number;
}

const EXERCISES: FixtureExercise[] = [
  { id: 1, tracking_type: "weight", is_unilateral: 0, double_weight: 0 },
  { id: 2, tracking_type: "assisted", is_unilateral: 0, double_weight: 0 },
  { id: 3, tracking_type: "reps", is_unilateral: 0, double_weight: 0 },
  { id: 4, tracking_type: "reps", is_unilateral: 1, double_weight: 0 },
  // Dips, logged with added weight through the per-workout override.
  { id: 5, tracking_type: "reps", is_unilateral: 0, double_weight: 0 },
  { id: 6, tracking_type: "weight", is_unilateral: 1, double_weight: 1 },
  { id: 7, tracking_type: "time", is_unilateral: 0, double_weight: 0 },
];

interface FixtureSet {
  weight: number | null;
  reps: number | null;
  time?: number | null;
  is_warmup?: boolean;
}
interface FixtureWorkout {
  id: number;
  date_completed: string;
  local_date: string;
  /** What the body weight lookup should find for this workout. */
  expectedBodyWeight: number;
  exercises: { id: number; resolved: string | null; sets: FixtureSet[] }[];
}

const full = (assist: number): FixtureWorkout["exercises"] => [
  {
    id: 1,
    resolved: "weight",
    sets: [
      { weight: 20, reps: 10, is_warmup: true },
      { weight: 100, reps: 5 },
    ],
  },
  { id: 2, resolved: "assisted", sets: [{ weight: assist, reps: 8 }] },
  { id: 3, resolved: "reps", sets: [{ weight: null, reps: 20 }] },
  { id: 4, resolved: "reps", sets: [{ weight: null, reps: 6 }] },
  { id: 5, resolved: "weight", sets: [{ weight: 10, reps: 8 }] },
  { id: 6, resolved: null, sets: [{ weight: 22.5, reps: 10 }] },
  { id: 7, resolved: "time", sets: [{ weight: null, reps: null, time: 60 }] },
];

// Body weight entries: 80 kg on 1 March, 75 kg on 1 June, 72 kg on 1 Sept;
// the setting mirrors the latest, 72.
const WORKOUTS: FixtureWorkout[] = [
  {
    id: 1,
    // Before the first entry: falls back to the setting.
    date_completed: "2026-02-10T18:00:00.000Z",
    local_date: "2026-02-10",
    expectedBodyWeight: 72,
    exercises: full(40),
  },
  {
    id: 2,
    date_completed: "2026-03-15T18:00:00.000Z",
    local_date: "2026-03-15",
    expectedBodyWeight: 80,
    exercises: full(30),
  },
  {
    id: 3,
    date_completed: "2026-06-20T18:00:00.000Z",
    local_date: "2026-06-20",
    expectedBodyWeight: 75,
    exercises: full(20),
  },
  {
    id: 4,
    date_completed: "2026-09-10T18:00:00.000Z",
    local_date: "2026-09-10",
    expectedBodyWeight: 72,
    exercises: full(90),
  },
];

const seed = (bodyWeightSetting: string | null = "72") => {
  const { sqlite } = mockDb;
  sqlite.exec(`
    INSERT INTO body_parts (body_part) VALUES ('back');
    INSERT INTO body_measurements (date, body_weight) VALUES
      ('2026-03-01T08:00:00.000Z', 80),
      ('2026-04-01T08:00:00.000Z', NULL),
      ('2026-06-01T08:00:00.000Z', 75),
      ('2026-09-01T08:00:00.000Z', 72);
  `);
  if (bodyWeightSetting != null) {
    sqlite
      .prepare(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
      )
      .run(bodyWeightSetting);
  }
  const insertExercise = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, body_part, tracking_type, is_unilateral, double_weight) VALUES (?, ?, 'back', ?, ?, ?)`,
  );
  for (const e of EXERCISES) {
    insertExercise.run(
      e.id,
      `Exercise ${e.id}`,
      e.tracking_type,
      e.is_unilateral,
      e.double_weight,
    );
  }
  for (const w of WORKOUTS) {
    sqlite
      .prepare(
        `INSERT INTO completed_workouts (id, date_completed, local_date, duration) VALUES (?, ?, ?, 3600)`,
      )
      .run(w.id, w.date_completed, w.local_date);
    for (const ex of w.exercises) {
      const { lastInsertRowid } = sqlite
        .prepare(
          `INSERT INTO completed_exercises (completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?)`,
        )
        .run(w.id, ex.id, ex.resolved);
      ex.sets.forEach((set, index) =>
        sqlite
          .prepare(
            `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, time, is_warmup) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            Number(lastInsertRowid),
            index + 1,
            set.weight,
            set.reps,
            set.time ?? null,
            set.is_warmup ? 1 : 0,
          ),
      );
    }
  }
};

const jsVolume = (
  workout: FixtureWorkout,
  options: WorkoutStatsOptions,
  bodyWeight: number | null = workout.expectedBodyWeight,
) =>
  workout.exercises.reduce((total, ex) => {
    const info = EXERCISES.find((e) => e.id === ex.id)!;
    const exercise = {
      tracking_type: ex.resolved || info.tracking_type,
      base_tracking_type: info.tracking_type,
      is_unilateral: info.is_unilateral,
      double_weight: info.double_weight,
    };
    return (
      total +
      ex.sets.reduce(
        (sum, set) => sum + setVolume(set, exercise, options, bodyWeight),
        0,
      )
    );
  }, 0);

const ALL_OPTIONS: WorkoutStatsOptions[] = [false, true].flatMap(
  (excludeWarmup) =>
    [false, true].flatMap((countUnilateralDouble) =>
      [false, true].flatMap((doubleWeightForPaired) =>
        [false, true].map((includeBodyWeight) => ({
          excludeWarmup,
          countUnilateralDouble,
          doubleWeightForPaired,
          includeBodyWeight,
        })),
      ),
    ),
);
const OFF = ALL_OPTIONS[0];
const ON = ALL_OPTIONS[1];

beforeEach(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
});

afterEach(() => mockDb.sqlite.close());

describe("volume in SQL and JS", () => {
  it.each(ALL_OPTIONS)("agree per workout with %o", async (options) => {
    seed();
    const summaries = await fetchWorkoutSummaries({}, options);

    for (const workout of WORKOUTS) {
      const summary = summaries.find((s) => s.id === workout.id)!;
      expect(summary.volume_kg).toBeCloseTo(jsVolume(workout, options), 6);
    }
  });

  it.each([OFF, ON])(
    "agree on the training split total with %o",
    async (options) => {
      seed();
      const rows = await fetchTrainingSplit({}, "bodyPart", options);
      const total = WORKOUTS.reduce((t, w) => t + jsVolume(w, options), 0);

      expect(mergeSplitRows(rows, "bodyPart", "volume").back).toBeCloseTo(
        total,
        6,
      );
    },
  );

  it("uses the body weight logged before each workout, not today's", async () => {
    seed();
    const [march] = await fetchWorkoutSummaries(
      { from: "2026-03-15", to: "2026-03-15" },
      ON,
    );

    // 80 kg in March: assisted (80 - 30) x 8, push-ups 80 x 20, pistols
    // 80 x 6, dips (80 + 10) x 8, plus bench and the paired press.
    const expected =
      100 * 5 + 20 * 10 + 50 * 8 + 80 * 20 + 80 * 6 + 90 * 8 + 225;
    expect(march.volume_kg).toBeCloseTo(expected, 6);
  });

  it("counts body-weight terms as zero when no body weight was ever logged", async () => {
    mockDb.sqlite.exec(`DELETE FROM settings WHERE key = 'bodyWeight'`);
    seed(null);
    mockDb.sqlite.exec(`DELETE FROM body_measurements`);
    const summaries = await fetchWorkoutSummaries({}, ON);

    for (const workout of WORKOUTS) {
      const summary = summaries.find((s) => s.id === workout.id)!;
      expect(summary.volume_kg).toBeCloseTo(jsVolume(workout, ON, null), 6);
    }
  });
});

describe("a loaded completed workout", () => {
  it("reads an empty saved tracking type as the exercise's own, like the SQL", async () => {
    seed();
    mockDb.sqlite.exec(
      `UPDATE completed_exercises SET resolved_tracking_type = '' WHERE exercise_id = 2`,
    );
    const workout = await fetchCompletedWorkoutById(2);
    const [summary] = await fetchWorkoutSummaries(
      { from: "2026-03-15", to: "2026-03-15" },
      OFF,
    );

    expect(
      workout.exercises.find((e) => e.exercise_id === 2)!
        .exercise_tracking_type,
    ).toBe("assisted");
    expect(completedWorkoutVolume(workout, OFF, "kg")).toBeCloseTo(
      summary.volume_kg,
      6,
    );
  });

  it("carries the body weight logged before it", async () => {
    seed();
    const march = await fetchCompletedWorkoutById(2);
    const february = await fetchCompletedWorkoutById(1);

    expect(march.body_weight_kg).toBe(80);
    expect(february.body_weight_kg).toBe(72);
  });

  it.each([OFF, ON])(
    "gives the same volume in JS as the SQL summary with %o",
    async (options) => {
      seed();
      const summaries = await fetchWorkoutSummaries({}, options);

      for (const fixture of WORKOUTS) {
        const workout = await fetchCompletedWorkoutById(fixture.id);
        const summary = summaries.find((s) => s.id === fixture.id)!;
        expect(completedWorkoutVolume(workout, options, "kg")).toBeCloseTo(
          summary.volume_kg,
          6,
        );
      }
    },
  );
});

describe("bodyweight-only history", () => {
  it("has no volume with the setting off and some with it on", async () => {
    seed();
    mockDb.sqlite.exec(`
      DELETE FROM completed_sets WHERE completed_exercise_id IN (
        SELECT id FROM completed_exercises WHERE exercise_id NOT IN (3, 4)
      );
    `);

    const off = await fetchWorkoutSummaries({}, OFF);
    const on = await fetchWorkoutSummaries({}, ON);

    expect(off.every((s) => s.volume_kg === 0)).toBe(true);
    expect(on.every((s) => s.volume_kg > 0)).toBe(true);
  });
});
