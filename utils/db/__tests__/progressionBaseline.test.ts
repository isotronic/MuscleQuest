// Progression measures against the latest real session of a plan exercise:
// not the all-time heaviest set, not a deleted session, not a deload week.
import {
  getExerciseProgressionContext,
  getProgressionRecomputeTargets,
  getProgressionState,
  getProgressionStatesForWorkout,
} from "@/utils/db/progression";
import { recomputeProgression } from "@/utils/progressionRecompute";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));
jest.mock("@/utils/database", () => jest.requireActual("@/utils/database"));

const UWE_ID = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Session {
  id: number;
  daysAgo: number;
  weight: number;
  isDeleted?: boolean;
  isDeload?: boolean;
}

const insertSession = ({
  id,
  daysAgo,
  weight,
  isDeleted,
  isDeload,
}: Session) => {
  const { sqlite } = mockDb;
  const when = new Date(Date.now() - daysAgo * DAY_MS);
  sqlite
    .prepare(
      `INSERT INTO completed_workouts (id, workout_id, date_completed, local_date, duration, total_sets_completed, is_deleted, is_deload)
       VALUES (?, 1, ?, ?, 1800, 3, ?, ?)`,
    )
    .run(
      id,
      when.toISOString(),
      when.toISOString().slice(0, 10),
      isDeleted ? 1 : 0,
      isDeload ? 1 : 0,
    );
  const { lastInsertRowid } = sqlite
    .prepare(
      `INSERT INTO completed_exercises (completed_workout_id, exercise_id) VALUES (?, 1)`,
    )
    .run(id);
  const insertSet = sqlite.prepare(
    `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, is_warmup) VALUES (?, ?, ?, ?, ?)`,
  );
  // A heavier warm-up would never count, so it must not leak in either.
  insertSet.run(Number(lastInsertRowid), 1, weight + 40, 3, 1);
  insertSet.run(Number(lastInsertRowid), 2, weight, 8, 0);
  insertSet.run(Number(lastInsertRowid), 3, weight - 5, 8, 0);
};

const seedPlan = () => {
  mockDb.sqlite.exec(`
    INSERT INTO muscles (muscle) VALUES ('pectorals');
    INSERT INTO body_parts (body_part) VALUES ('chest');
    INSERT INTO equipment_list (equipment) VALUES ('barbell');
    INSERT INTO exercises (exercise_id, name, equipment, body_part, target_muscle, tracking_type)
      VALUES (1, 'Bench press', 'barbell', 'chest', 'pectorals', 'weight');
    INSERT INTO user_workouts (id, name) VALUES (1, 'Push day');
    INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, exercise_order)
      VALUES (${UWE_ID}, 1, 1, '[]', 0);
  `);
};

// 100 kg (older), 80 kg (latest real session), then a deleted 150 kg session
// and a deload at 60 kg, both after it.
const seedHistory = (offsetDays = 0) => {
  insertSession({ id: 1, daysAgo: offsetDays + 10, weight: 100 });
  insertSession({ id: 2, daysAgo: offsetDays + 7, weight: 80 });
  insertSession({
    id: 3,
    daysAgo: offsetDays + 5,
    weight: 150,
    isDeleted: true,
  });
  insertSession({ id: 4, daysAgo: offsetDays + 3, weight: 60, isDeload: true });
};

const seedFeedback = (
  effort: "easy" | "moderate",
  pain: "none" | "pain",
  consecutiveDirectionCount = 1,
) => {
  mockDb.sqlite
    .prepare(
      `INSERT INTO exercise_feedback (user_workout_exercise_id, effort_rating, pain_flag, performance_ratio)
       VALUES (?, ?, ?, 1.0)`,
    )
    .run(UWE_ID, effort, pain);
  mockDb.sqlite
    .prepare(
      `INSERT INTO exercise_progression_state (user_workout_exercise_id, suggestion_action, rule_key, rule_explanation, consecutive_direction_count)
       VALUES (?, 'hold', 'DEFAULT', 'Hold', ?)`,
    )
    .run(UWE_ID, consecutiveDirectionCount);
};

const storedSuggestion = () =>
  mockDb.sqlite
    .prepare(
      `SELECT suggestion_action, suggested_weight, rule_key FROM exercise_progression_state WHERE user_workout_exercise_id = ?`,
    )
    .get(UWE_ID) as {
    suggestion_action: string;
    suggested_weight: number | null;
    rule_key: string;
  };

beforeEach(async () => {
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
  seedPlan();
});

describe("progression baseline", () => {
  it("uses the heaviest working set of the latest real session", async () => {
    seedHistory();
    const ctx = await getExerciseProgressionContext(UWE_ID);
    expect(ctx?.recentWorkingWeight).toBe(80);
  });

  it("increases from the latest session, not the all-time maximum", async () => {
    seedHistory();
    seedFeedback("easy", "none");
    await recomputeProgression(UWE_ID, { recoveryRating: "fresh" });
    expect(storedSuggestion()).toMatchObject({
      suggestion_action: "increase_load",
      suggested_weight: 82.5,
    });
  });

  it("reduces for repeated pain from the latest session", async () => {
    seedHistory();
    seedFeedback("moderate", "pain", 2);
    await recomputeProgression(UWE_ID);
    expect(storedSuggestion()).toMatchObject({
      rule_key: "PAIN_LOAD",
      suggested_weight: 76,
    });
  });

  it("eases back in from the latest session after a layoff", async () => {
    seedHistory(21);
    seedFeedback("easy", "none");
    const state = await getProgressionState(UWE_ID);
    expect(state?.ruleKey).toBe("MUSCLE_LAYOFF");
    expect(state?.suggestedWeight).toBeLessThan(80);

    const [row] = await getProgressionStatesForWorkout(1);
    expect(row.ruleKey).toBe("MUSCLE_LAYOFF");
    expect(row.suggestedWeight).toBe(state?.suggestedWeight);
  });

  it("has no baseline when every session is deleted or a deload", async () => {
    insertSession({ id: 1, daysAgo: 5, weight: 150, isDeleted: true });
    insertSession({ id: 2, daysAgo: 3, weight: 60, isDeload: true });
    seedFeedback("easy", "none");

    const ctx = await getExerciseProgressionContext(UWE_ID);
    expect(ctx?.recentWorkingWeight).toBeNull();

    await recomputeProgression(UWE_ID, { recoveryRating: "fresh" });
    expect(storedSuggestion()).toMatchObject({
      suggestion_action: "hold",
      rule_key: "NO_PRIOR_WEIGHT",
    });
  });

  describe("history edit refresh", () => {
    it("refreshes from the latest real session when a deload came after it", async () => {
      seedHistory();
      seedFeedback("easy", "none");
      expect(await getProgressionRecomputeTargets(2)).toEqual([
        {
          userWorkoutExerciseId: UWE_ID,
          recentWorkingWeight: 80,
          completedRepsPerSet: [8, 8],
        },
      ]);
    });

    it("ignores a change to a deload session", async () => {
      seedHistory();
      seedFeedback("easy", "none");
      expect(await getProgressionRecomputeTargets(4)).toEqual([]);
    });
  });
});
