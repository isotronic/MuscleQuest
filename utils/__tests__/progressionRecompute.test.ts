// progressionRecompute.test.ts
//
// Runs the real queries against an in-memory SQLite: whether a suggestion is
// refreshed depends on which session the SQL treats as the most recent.
import {
  recomputeProgression,
  recomputeProgressionForCompletedWorkout,
} from "@/utils/progressionRecompute";
import { initUserDataDB } from "@/utils/initUserDataDB";
import { DatabaseSync } from "node:sqlite";

// Run the real database.ts; only the native driver underneath is replaced.
jest.unmock("@/utils/database");
// Break circular imports, as database.test.ts does.
jest.mock("@/hooks/useCompletedWorkoutsQuery", () => ({}));
jest.mock("@/store/workoutStore", () => ({}));

let mockSqlite: DatabaseSync;

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => {
    const adapter: any = {
      execAsync: async (sql: string) => mockSqlite.exec(sql),
      runAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).run(...params),
      getAllAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: any[] = []) =>
        mockSqlite.prepare(sql).get(...params) ?? null,
      withExclusiveTransactionAsync: async (fn: (txn: any) => Promise<void>) =>
        fn(adapter),
      closeAsync: async () => {},
    };
    return adapter;
  }),
}));

const EXERCISE_ID = 7;
const WORKOUT_ID = 3;
const UWE_ID = 11;
const PLAN_SETS = [
  { repsMin: 8, repsMax: 10, restMinutes: 2, restSeconds: 0 },
  { repsMin: 8, repsMax: 10, restMinutes: 2, restSeconds: 0 },
];

let nextCompletedWorkoutId = 1;

// One session of two working sets of `kg` x `reps` on `day`.
const logSession = (
  day: string,
  kg: number,
  { reps = 10, workoutId = WORKOUT_ID as number | null } = {},
) => {
  const id = nextCompletedWorkoutId++;
  mockSqlite
    .prepare(
      `INSERT INTO completed_workouts (id, workout_id, date_completed, local_date, duration, total_sets_completed, is_deleted)
       VALUES (?, ?, ?, ?, 600, 2, 0)`,
    )
    .run(id, workoutId, `${day}T18:00:00.000Z`, day);
  const exercise = mockSqlite
    .prepare(
      `INSERT INTO completed_exercises (completed_workout_id, exercise_id, is_deleted)
       VALUES (?, ?, 0)`,
    )
    .run(id, EXERCISE_ID);
  for (let n = 1; n <= 2; n++) {
    mockSqlite
      .prepare(
        `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup, is_drop_set, is_deleted)
         VALUES (?, ?, ?, ?, 0, 0, 0)`,
      )
      .run(exercise.lastInsertRowid, n, kg, reps);
  }
  return id;
};

const editWeight = (completedWorkoutId: number, kg: number) =>
  mockSqlite
    .prepare(
      `UPDATE completed_sets SET weight = ? WHERE completed_exercise_id IN (
         SELECT id FROM completed_exercises WHERE completed_workout_id = ?)`,
    )
    .run(kg, completedWorkoutId);

const softDelete = (completedWorkoutId: number) => {
  mockSqlite
    .prepare(`UPDATE completed_workouts SET is_deleted = TRUE WHERE id = ?`)
    .run(completedWorkoutId);
  mockSqlite
    .prepare(
      `UPDATE completed_exercises SET is_deleted = TRUE WHERE completed_workout_id = ?`,
    )
    .run(completedWorkoutId);
  mockSqlite
    .prepare(
      `UPDATE completed_sets SET is_deleted = TRUE WHERE completed_exercise_id IN (
         SELECT id FROM completed_exercises WHERE completed_workout_id = ?)`,
    )
    .run(completedWorkoutId);
};

const addFeedback = (effort = "easy") =>
  Number(
    mockSqlite
      .prepare(
        `INSERT INTO exercise_feedback (user_workout_exercise_id, effort_rating, pain_flag, performance_ratio)
         VALUES (?, ?, 'none', 1.0)`,
      )
      .run(UWE_ID, effort).lastInsertRowid,
  );

// The stale suggestion as it was persisted when feedback was given.
const seedState = (
  feedbackId: number,
  overrides: Record<string, string | number> = {},
) => {
  const row = {
    suggestion_action: "increase_load",
    suggested_weight: 1002.5,
    rule_key: "EASY_TARGET_LOAD",
    is_applied: 0,
    is_dismissed: 0,
    consecutive_hold_count: 0,
    ...overrides,
  };
  mockSqlite
    .prepare(
      `INSERT INTO exercise_progression_state (
         user_workout_exercise_id, suggestion_action, suggested_weight, rule_key,
         rule_explanation, source_feedback_id, consecutive_direction_count,
         is_applied, is_dismissed, consecutive_hold_count
       ) VALUES (?, ?, ?, ?, 'stale', ?, 1, ?, ?, ?)`,
    )
    .run(
      UWE_ID,
      row.suggestion_action,
      row.suggested_weight,
      row.rule_key,
      feedbackId,
      row.is_applied,
      row.is_dismissed,
      row.consecutive_hold_count,
    );
};

const readState = () =>
  mockSqlite
    .prepare(
      `SELECT suggestion_action, suggested_weight, rule_key, consecutive_hold_count, is_applied, is_dismissed
       FROM exercise_progression_state WHERE user_workout_exercise_id = ?`,
    )
    .get(UWE_ID) as Record<string, string | number>;

const setProgressionEnabled = (enabled: boolean) =>
  mockSqlite
    .prepare(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('adaptive_progression_enabled', ?)`,
    )
    .run(enabled ? "1" : "0");

beforeEach(async () => {
  mockSqlite = new DatabaseSync(":memory:");
  nextCompletedWorkoutId = 1;
  await initUserDataDB();
  // The fixtures skip the lookup and plan rows the foreign keys point at.
  mockSqlite.exec("PRAGMA foreign_keys = OFF");
  mockSqlite
    .prepare(
      `INSERT INTO exercises (exercise_id, name, tracking_type, equipment, target_muscle)
       VALUES (?, 'Bench Press', 'weight', 'barbell', 'pectorals')`,
    )
    .run(EXERCISE_ID);
  mockSqlite
    .prepare(
      `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, exercise_order, is_deleted)
       VALUES (?, ?, ?, ?, 0, 0)`,
    )
    .run(UWE_ID, WORKOUT_ID, EXERCISE_ID, JSON.stringify(PLAN_SETS));
  setProgressionEnabled(true);
});

afterEach(() => mockSqlite.close());

describe("recomputeProgressionForCompletedWorkout", () => {
  it("rebases the pending suggestion when the latest session's weight is corrected", async () => {
    logSession("2026-09-01", 95);
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback());

    editWeight(latest, 100);
    const recomputed = await recomputeProgressionForCompletedWorkout(latest);

    expect(recomputed).toEqual([UWE_ID]);
    expect(readState()).toMatchObject({
      suggestion_action: "increase_load",
      suggested_weight: 102.5,
    });
  });

  it("bases the suggestion on the latest session, not on a heavier older one", async () => {
    logSession("2026-09-01", 120);
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback());

    editWeight(latest, 100);
    await recomputeProgressionForCompletedWorkout(latest);

    expect(readState().suggested_weight).toBe(102.5);
  });

  it("keeps a rep suggestion a rep suggestion when the reps were below the ceiling", async () => {
    const latest = logSession("2026-09-08", 1000, { reps: 8 });
    seedState(addFeedback(), {
      suggestion_action: "increase_reps",
      rule_key: "EASY_TARGET_REPS",
    });

    editWeight(latest, 100);
    await recomputeProgressionForCompletedWorkout(latest);

    expect(readState()).toMatchObject({
      suggestion_action: "increase_reps",
      suggested_weight: null,
    });
  });

  it("leaves the suggestion alone when an older session is edited", async () => {
    const older = logSession("2026-09-01", 95);
    logSession("2026-09-08", 1000);
    seedState(addFeedback());

    editWeight(older, 90);
    const recomputed = await recomputeProgressionForCompletedWorkout(older);

    expect(recomputed).toEqual([]);
    expect(readState().suggested_weight).toBe(1002.5);
  });

  it.each([
    ["applied", { is_applied: 1 }],
    ["dismissed", { is_dismissed: 1 }],
  ])("does not change a suggestion that was %s", async (_label, flags) => {
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback(), flags);

    editWeight(latest, 100);
    const recomputed = await recomputeProgressionForCompletedWorkout(latest);

    expect(recomputed).toEqual([]);
    expect(readState()).toMatchObject({ suggested_weight: 1002.5, ...flags });
  });

  it("does nothing while adaptive progression is disabled", async () => {
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback());
    setProgressionEnabled(false);

    editWeight(latest, 100);
    const recomputed = await recomputeProgressionForCompletedWorkout(latest);

    expect(recomputed).toEqual([]);
    expect(readState().suggested_weight).toBe(1002.5);
  });

  it("does nothing for a quick workout", async () => {
    const quick = logSession("2026-09-08", 1000, { workoutId: null });
    seedState(addFeedback());

    expect(await recomputeProgressionForCompletedWorkout(quick)).toEqual([]);
    expect(readState().suggested_weight).toBe(1002.5);
  });

  it("falls back to the previous session when the latest one is deleted", async () => {
    logSession("2026-09-01", 95);
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback());

    softDelete(latest);
    const recomputed = await recomputeProgressionForCompletedWorkout(latest);

    expect(recomputed).toEqual([UWE_ID]);
    expect(readState().suggested_weight).toBe(97.5);
  });

  it("leaves the suggestion alone when an older session is deleted", async () => {
    const older = logSession("2026-09-01", 95);
    logSession("2026-09-08", 100);
    seedState(addFeedback(), { suggested_weight: 102.5 });

    softDelete(older);

    expect(await recomputeProgressionForCompletedWorkout(older)).toEqual([]);
    expect(readState().suggested_weight).toBe(102.5);
  });

  it("does not count the same session twice towards a plateau", async () => {
    const latest = logSession("2026-09-08", 1000);
    seedState(addFeedback("hard"), {
      suggestion_action: "hold",
      rule_key: "HARD_TARGET",
      consecutive_hold_count: 2,
    });

    editWeight(latest, 100);
    await recomputeProgressionForCompletedWorkout(latest);

    expect(readState()).toMatchObject({
      rule_key: "HARD_TARGET",
      consecutive_hold_count: 2,
    });
  });
});

describe("recomputeProgression (recovery check-in path)", () => {
  it("holds when recovery is sore", async () => {
    logSession("2026-09-08", 100);
    seedState(addFeedback(), { suggested_weight: 102.5 });

    await recomputeProgression(UWE_ID, { recoveryRating: "sore" });

    expect(readState()).toMatchObject({
      suggestion_action: "hold",
      rule_key: "POOR_RECOVERY",
    });
  });

  it("advances the hold count for a stagnation hold", async () => {
    logSession("2026-09-08", 100);
    seedState(addFeedback("hard"), {
      suggestion_action: "hold",
      rule_key: "HARD_TARGET",
      consecutive_hold_count: 2,
    });

    await recomputeProgression(UWE_ID, { recoveryRating: "fresh" });

    expect(readState().consecutive_hold_count).toBe(3);
  });

  it("does nothing without feedback", async () => {
    logSession("2026-09-08", 100);

    expect(
      await recomputeProgression(UWE_ID, { recoveryRating: "fresh" }),
    ).toBe(false);
  });
});
