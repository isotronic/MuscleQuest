// The stats screen used to load every logged set and aggregate in JS. These
// tests run the SQL aggregates against a real SQLite and compare them with the
// JS computations they replace, written out below as the reference.
import {
  fetchBodyPartSetCounts,
  fetchHasCompletedWorkout,
  fetchWorkoutSummaries,
  type WorkoutStatsOptions,
} from "@/utils/db/workoutStats";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

interface SeedSet {
  weight: number | null;
  reps: number | null;
  is_warmup: boolean;
}
interface SeedExercise {
  exercise_id: number;
  sets: SeedSet[];
}
interface SeedWorkout {
  id: number;
  local_date: string;
  duration: number;
  is_deleted: boolean;
  exercises: SeedExercise[];
}

const EXERCISES = [
  { id: 1, body_part: "chest", unilateral: 0, double: 0, deleted: 0 },
  { id: 2, body_part: "upper arms", unilateral: 1, double: 0, deleted: 0 },
  { id: 3, body_part: "lower arms", unilateral: 0, double: 1, deleted: 0 },
  { id: 4, body_part: "upper legs", unilateral: 1, double: 1, deleted: 0 },
  { id: 5, body_part: "lower legs", unilateral: 0, double: 0, deleted: 0 },
  { id: 6, body_part: "back", unilateral: 0, double: 0, deleted: 1 },
  { id: 7, body_part: "cardio", unilateral: 0, double: 0, deleted: 0 },
];

const pad = (n: number) => String(n).padStart(2, "0");

// 60 workouts, one every other day from 2026-01-01, deterministic variety:
// warm-ups, time-only sets, zero reps, a deleted exercise, a deleted workout
// and a workout with nothing logged.
const seedWorkouts = (): SeedWorkout[] => {
  const workouts: SeedWorkout[] = [];
  for (let i = 0; i < 60; i++) {
    const day = new Date(2026, 0, 1 + i * 2);
    const local_date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const exercises: SeedExercise[] = [];
    if (i !== 7) {
      for (let e = 0; e < 3; e++) {
        const exercise = EXERCISES[(i + e * 2) % EXERCISES.length];
        const sets: SeedSet[] = [];
        for (let s = 0; s < 4; s++) {
          const timeOnly = exercise.id === 7;
          sets.push({
            weight: timeOnly ? null : 20 + ((i * 7 + e * 3 + s) % 40) * 2.5,
            reps: timeOnly ? null : (i + s) % 9 === 0 ? 0 : 5 + ((i + s) % 8),
            is_warmup: s === 0 && i % 2 === 0,
          });
        }
        exercises.push({ exercise_id: exercise.id, sets });
      }
    }
    workouts.push({
      id: i + 1,
      local_date,
      duration: 1800 + i * 37,
      is_deleted: i === 11,
      exercises,
    });
  }
  return workouts;
};

const insertSeed = (workouts: SeedWorkout[]) => {
  const { sqlite } = mockDb;
  const insertExercise = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, body_part, is_unilateral, double_weight, is_deleted) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  // The body_parts table is a foreign key target in the schema.
  for (const exercise of EXERCISES) {
    sqlite
      .prepare(`INSERT OR IGNORE INTO body_parts (body_part) VALUES (?)`)
      .run(exercise.body_part);
    insertExercise.run(
      exercise.id,
      `Exercise ${exercise.id}`,
      exercise.body_part,
      exercise.unilateral,
      exercise.double,
      exercise.deleted,
    );
  }
  sqlite.exec(`INSERT INTO user_workouts (id, name) VALUES (1, 'Push day');`);
  const insertWorkout = sqlite.prepare(
    `INSERT INTO completed_workouts (id, workout_id, date_completed, local_date, duration, total_sets_completed, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCompletedExercise = sqlite.prepare(
    `INSERT INTO completed_exercises (completed_workout_id, exercise_id) VALUES (?, ?)`,
  );
  const insertSet = sqlite.prepare(
    `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const workout of workouts) {
    insertWorkout.run(
      workout.id,
      workout.id % 3 === 0 ? null : 1,
      `${workout.local_date}T18:30:00.000Z`,
      workout.local_date,
      workout.duration,
      workout.exercises.reduce((n, e) => n + e.sets.length, 0),
      workout.is_deleted ? 1 : 0,
    );
    for (const exercise of workout.exercises) {
      const { lastInsertRowid } = insertCompletedExercise.run(
        workout.id,
        exercise.exercise_id,
      );
      exercise.sets.forEach((set, index) =>
        insertSet.run(
          Number(lastInsertRowid),
          index + 1,
          set.weight,
          set.reps,
          set.is_warmup ? 1 : 0,
        ),
      );
    }
  }
};

// The JS the stats screen ran over fully loaded workouts (computeStats and
// groupVolumeByTime), per workout.
const referenceVolume = (workout: SeedWorkout, options: WorkoutStatsOptions) =>
  workout.exercises.reduce((total, exercise) => {
    const flags = EXERCISES.find((e) => e.id === exercise.exercise_id)!;
    const weightM = options.doubleWeightForPaired && flags.double ? 2 : 1;
    const repM = options.countUnilateralDouble && flags.unilateral ? 2 : 1;
    return (
      total +
      exercise.sets.reduce(
        (sum, set) =>
          (!options.excludeWarmup || !set.is_warmup) && set.weight && set.reps
            ? sum + set.weight * weightM * set.reps * repM
            : sum,
        0,
      )
    );
  }, 0);

const referenceSetCount = (workout: SeedWorkout, excludeWarmup: boolean) =>
  workout.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.filter((set) => !excludeWarmup || !set.is_warmup).length,
    0,
  );

// BodyPartChart and useStatsInsights counted sets per body part, looking the
// body part up in the list of exercises that are not deleted.
const referenceBodyParts = (
  workouts: SeedWorkout[],
  excludeWarmup: boolean,
) => {
  const counts: Record<string, number> = {};
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const info = EXERCISES.find((e) => e.id === exercise.exercise_id)!;
      if (info.deleted) continue;
      counts[info.body_part] =
        (counts[info.body_part] ?? 0) +
        exercise.sets.filter((set) => !excludeWarmup || !set.is_warmup).length;
    }
  }
  return counts;
};

const ALL_OPTIONS: WorkoutStatsOptions[] = [false, true].flatMap(
  (excludeWarmup) =>
    [false, true].flatMap((countUnilateralDouble) =>
      [false, true].map((doubleWeightForPaired) => ({
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      })),
    ),
);

const NO_OPTIONS = ALL_OPTIONS[0];
let seeded: SeedWorkout[];
let live: SeedWorkout[];

beforeAll(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  seeded = seedWorkouts();
  live = seeded.filter((workout) => !workout.is_deleted);
  insertSeed(seeded);
});

afterAll(() => mockDb.sqlite.close());

describe("fetchWorkoutSummaries", () => {
  it("returns one row per completed workout, newest first", async () => {
    const summaries = await fetchWorkoutSummaries({}, NO_OPTIONS);

    expect(summaries.map((s) => s.id)).toEqual(live.map((w) => w.id).reverse());
  });

  it("carries what a history card shows", async () => {
    const summaries = await fetchWorkoutSummaries({}, NO_OPTIONS);
    const workout = live.find((w) => w.id === 1)!;

    expect(summaries.find((s) => s.id === 1)).toMatchObject({
      workout_id: 1,
      workout_name: "Push day",
      local_date: workout.local_date,
      date_completed: `${workout.local_date}T18:30:00.000Z`,
      duration: workout.duration,
      total_sets_completed: 12,
      is_deload: 0,
    });
  });

  it("names a workout with no plan workout 'Quick Workout'", async () => {
    const summaries = await fetchWorkoutSummaries({}, NO_OPTIONS);

    expect(summaries.find((s) => s.id === 3)!.workout_name).toBe(
      "Quick Workout",
    );
  });

  it.each(ALL_OPTIONS)(
    "matches the JS volume and set count per workout with %o",
    async (options) => {
      const summaries = await fetchWorkoutSummaries({}, options);

      for (const workout of live) {
        const summary = summaries.find((s) => s.id === workout.id)!;
        expect(summary.volume_kg).toBeCloseTo(
          referenceVolume(workout, options),
          6,
        );
        expect(summary.set_count).toBe(
          referenceSetCount(workout, options.excludeWarmup),
        );
      }
    },
  );

  it("reports zero for a workout with nothing logged", async () => {
    const summaries = await fetchWorkoutSummaries({}, NO_OPTIONS);

    expect(summaries.find((s) => s.id === 8)).toMatchObject({
      set_count: 0,
      volume_kg: 0,
    });
  });

  it("keeps both ends of a local date range", async () => {
    const summaries = await fetchWorkoutSummaries(
      { from: "2026-01-03", to: "2026-01-09" },
      NO_OPTIONS,
    );

    expect(summaries.map((s) => s.local_date)).toEqual([
      "2026-01-09",
      "2026-01-07",
      "2026-01-05",
      "2026-01-03",
    ]);
  });

  it("accepts an open-ended range", async () => {
    const summaries = await fetchWorkoutSummaries(
      { from: "2026-04-25" },
      NO_OPTIONS,
    );

    expect(summaries.map((s) => s.local_date)).toEqual([
      "2026-04-29",
      "2026-04-27",
      "2026-04-25",
    ]);
  });
});

describe("fetchBodyPartSetCounts", () => {
  const asRecord = (rows: { body_part: string; set_count: number }[]) =>
    Object.fromEntries(rows.map((row) => [row.body_part, row.set_count]));

  it.each([false, true])(
    "matches the JS set counts per body part (excludeWarmup %p)",
    async (excludeWarmup) => {
      const rows = await fetchBodyPartSetCounts({}, excludeWarmup);

      expect(asRecord(rows)).toEqual(referenceBodyParts(live, excludeWarmup));
    },
  );

  it("counts only workouts inside the range", async () => {
    const inRange = live.filter(
      (w) => w.local_date >= "2026-02-01" && w.local_date <= "2026-02-28",
    );

    const rows = await fetchBodyPartSetCounts(
      { from: "2026-02-01", to: "2026-02-28" },
      false,
    );

    expect(asRecord(rows)).toEqual(referenceBodyParts(inRange, false));
  });
});

describe("fetchHasCompletedWorkout", () => {
  it("is true once a workout has been completed", async () => {
    expect(await fetchHasCompletedWorkout()).toBe(true);
  });

  it("ignores deleted workouts", async () => {
    mockDb.sqlite.exec(`
      SAVEPOINT only_deleted;
      UPDATE completed_workouts SET is_deleted = TRUE;
    `);

    expect(await fetchHasCompletedWorkout()).toBe(false);

    mockDb.sqlite.exec(`ROLLBACK TO only_deleted; RELEASE only_deleted;`);
  });
});
