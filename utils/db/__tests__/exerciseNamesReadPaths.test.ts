// Real SQL for both sides of the translated-name boundary: read paths that
// feed screens show the device language, and paths that publish to friends
// keep the stored English name. A query that stops selecting
// app_exercise_id would silently fall back to English, and a refactor that
// routed sharing through the translated helpers would leak German names to
// friends on other languages; both fail here.
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { loadExerciseNames } from "@/utils/db/exerciseNames";
import { getStandaloneWorkouts } from "@/utils/db/standaloneWorkouts";
import {
  fetchCompletedWorkoutById,
  fetchPRDataForExercises,
} from "@/utils/db/workouts";
import { fetchStandaloneWorkoutForSharing } from "@/utils/db/sharingQueries";

let mockUserData: ReturnType<typeof createNodeSqliteDb>;
let mockLibrary: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: async (name: string) =>
    name === "userData.db" ? mockUserData.db : mockLibrary.db,
}));

const seed = (sqlite: DatabaseSync) =>
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    INSERT INTO settings (key, value) VALUES ('translateExerciseNames', 'true');
    INSERT INTO exercises (exercise_id, app_exercise_id, name, tracking_type)
      VALUES (7, 11, 'Barbell Bench Press', NULL),
             (8, NULL, 'My Press', NULL);
    INSERT INTO user_workouts (id, plan_id, name) VALUES (1, NULL, 'Chest');
    INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, exercise_order)
      VALUES (1, 1, 7, '[]', 0), (2, 1, 8, '[]', 1);
    INSERT INTO completed_workouts (id, workout_id, date_completed, local_date)
      VALUES (1, 1, '2026-10-01T10:00:00.000Z', '2026-10-01');
    INSERT INTO completed_exercises (id, completed_workout_id, exercise_id, resolved_tracking_type)
      VALUES (1, 1, 7, 'weight'), (2, 1, 8, 'weight');
    INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup, is_deleted)
      VALUES (1, 1, 80, 5, 0, 0), (2, 1, 40, 8, 0, 0);
  `);

beforeAll(async () => {
  mockUserData = createNodeSqliteDb();
  await runMigrations(mockUserData.db);
  seed(mockUserData.sqlite);
  mockLibrary = createNodeSqliteDb();
  mockLibrary.sqlite.exec(`
    CREATE TABLE exercise_translations (exercise_id INTEGER, locale TEXT, name TEXT);
    INSERT INTO exercise_translations VALUES (11, 'de', 'Langhantel-Bankdrücken');
  `);
  await loadExerciseNames("de");
});

afterAll(async () => {
  await loadExerciseNames("en");
  mockUserData.sqlite.close();
  mockLibrary.sqlite.close();
});

describe("read paths that feed screens", () => {
  it("show workouts outside plans in the device language", async () => {
    const [workout] = await getStandaloneWorkouts();

    expect(workout.exercises.map((e) => e.name)).toEqual([
      "Langhantel-Bankdrücken",
      "My Press",
    ]);
  });

  it("show a completed workout in the device language", async () => {
    const workout = await fetchCompletedWorkoutById(1);

    expect(workout.exercises.map((e) => e.exercise_name)).toEqual([
      "Langhantel-Bankdrücken",
      "My Press",
    ]);
  });
});

describe("paths that publish to friends", () => {
  it("send PRs with the stored English name", async () => {
    const prs = await fetchPRDataForExercises([7]);

    expect(prs.map((pr) => pr.exercise_name)).toEqual(["Barbell Bench Press"]);
  });

  it("send a shared workout with the stored English name", async () => {
    const shared = await fetchStandaloneWorkoutForSharing(1);

    expect(JSON.stringify(shared)).toContain("Barbell Bench Press");
    expect(JSON.stringify(shared)).not.toContain("Langhantel");
  });
});
