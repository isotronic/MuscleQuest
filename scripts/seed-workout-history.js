#!/usr/bin/env node
//
// Dev-only: fills a userData.db with synthetic workout history so history
// performance can be measured on a real device with a realistic dataset.
//
// This writes to a database file on your machine, never to a device directly.
// The round trip on Android is:
//
//   adb exec-out run-as <applicationId> cat databases/SQLite/userData.db > userData.db
//   node scripts/seed-workout-history.js userData.db --workouts 500
//   adb exec-out run-as <applicationId> sh -c 'cat > databases/SQLite/userData.db' < userData.db
//
// Every inserted completed_workouts id is recorded in the settings table under
// `dev_seeded_workout_ids`, so `--undo` removes exactly what was added and
// nothing else.
//
// Requires Node 22+ for the built-in node:sqlite module.

const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SEED_KEY = "dev_seeded_workout_ids";
const EXERCISES_PER_WORKOUT = 8;
const SETS_PER_EXERCISE = 4;

function parseArgs(argv) {
  const args = { file: null, workouts: 500, undo: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--undo") args.undo = true;
    else if (arg === "--workouts") args.workouts = Number(argv[++i]);
    else if (arg.startsWith("--")) fail(`Unknown flag: ${arg}`);
    else if (args.file === null) args.file = arg;
    else fail(`Unexpected argument: ${arg}`);
  }
  if (!args.file)
    fail(
      "Usage: seed-workout-history.js <userData.db> [--workouts N] [--undo]",
    );
  if (!args.undo && (!Number.isInteger(args.workouts) || args.workouts < 1)) {
    fail("--workouts must be a positive integer");
  }
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readSeededIds(db) {
  const row = db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .get(SEED_KEY);
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSeededIds(db, ids) {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(
    SEED_KEY,
    JSON.stringify(ids),
  );
}

function undo(db) {
  const ids = readSeededIds(db);
  if (ids.length === 0) {
    console.log(
      "Nothing to undo: no seeded workouts recorded in this database.",
    );
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  db.exec("BEGIN");
  try {
    db.prepare(
      `DELETE FROM completed_sets WHERE completed_exercise_id IN
         (SELECT id FROM completed_exercises WHERE completed_workout_id IN (${placeholders}))`,
    ).run(...ids);
    db.prepare(
      `DELETE FROM completed_exercises WHERE completed_workout_id IN (${placeholders})`,
    ).run(...ids);
    db.prepare(
      `DELETE FROM completed_workouts WHERE id IN (${placeholders})`,
    ).run(...ids);
    db.prepare(`DELETE FROM settings WHERE key = ?`).run(SEED_KEY);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(
    `Removed ${ids.length} seeded workouts and their exercises and sets.`,
  );
}

function seed(db, workoutCount) {
  const exerciseIds = db
    .prepare(`SELECT exercise_id FROM exercises ORDER BY exercise_id LIMIT 200`)
    .all()
    .map((row) => row.exercise_id);
  if (exerciseIds.length === 0) {
    fail(
      "No rows in `exercises`. Open the app once so the exercise catalogue is populated.",
    );
  }

  const userWorkouts = db
    .prepare(
      `SELECT id, plan_id FROM user_workouts WHERE is_deleted IS NOT TRUE`,
    )
    .all();
  if (userWorkouts.length === 0) {
    fail(
      "No rows in `user_workouts`. Create at least one workout in the app first.",
    );
  }

  const insertWorkout = db.prepare(
    `INSERT INTO completed_workouts
       (plan_id, workout_id, date_completed, duration, total_sets_completed, is_deleted)
     VALUES (?, ?, ?, ?, ?, 0)`,
  );
  const insertExercise = db.prepare(
    `INSERT INTO completed_exercises
       (completed_workout_id, exercise_id, resolved_tracking_type, is_deleted)
     VALUES (?, ?, 'weight', 0)`,
  );
  const insertSet = db.prepare(
    `INSERT INTO completed_sets
       (completed_exercise_id, set_number, weight, reps, is_warmup, is_drop_set, set_duration, is_deleted)
     VALUES (?, ?, ?, ?, 0, 0, ?, 0)`,
  );

  const seededIds = readSeededIds(db);
  // Roughly four sessions a week, backwards from today.
  const dayStep = 7 / 4;

  db.exec("BEGIN");
  try {
    for (let i = 0; i < workoutCount; i++) {
      const template = userWorkouts[i % userWorkouts.length];
      const date = new Date();
      date.setDate(date.getDate() - Math.round(i * dayStep));

      const workoutResult = insertWorkout.run(
        template.plan_id ?? null,
        template.id,
        date.toISOString().replace("T", " ").slice(0, 19),
        3000 + ((i * 37) % 1800),
        EXERCISES_PER_WORKOUT * SETS_PER_EXERCISE,
      );
      const completedWorkoutId = Number(workoutResult.lastInsertRowid);
      seededIds.push(completedWorkoutId);

      for (let e = 0; e < EXERCISES_PER_WORKOUT; e++) {
        const exerciseId =
          exerciseIds[(i * EXERCISES_PER_WORKOUT + e) % exerciseIds.length];
        const exerciseResult = insertExercise.run(
          completedWorkoutId,
          exerciseId,
        );
        const completedExerciseId = Number(exerciseResult.lastInsertRowid);

        for (let s = 0; s < SETS_PER_EXERCISE; s++) {
          // Drift the load upwards over time so charts and PRs have shape.
          const weight = 40 + ((workoutCount - i) % 60) + s * 2.5;
          insertSet.run(
            completedExerciseId,
            s + 1,
            weight,
            8 + (s % 4),
            45 + s * 5,
          );
        }
      }
    }
    writeSeededIds(db, seededIds);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  console.log(
    `Seeded ${workoutCount} workouts ` +
      `(${workoutCount * EXERCISES_PER_WORKOUT} exercises, ` +
      `${workoutCount * EXERCISES_PER_WORKOUT * SETS_PER_EXERCISE} sets).`,
  );
  console.log(`Run with --undo to remove them.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = path.resolve(args.file);
  const db = new DatabaseSync(file);
  try {
    if (args.undo) undo(db);
    else seed(db, args.workouts);
  } finally {
    db.close();
  }
}

main();
