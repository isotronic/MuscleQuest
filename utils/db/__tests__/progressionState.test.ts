import { setupUserDb } from "@/utils/db/testing/setupUserDb";
import {
  applyProgressionToExercise,
  dismissProgressionState,
  getDeloadWeek,
  getPendingRecoveryCheckIns,
  setDeloadWeek,
} from "@/utils/db/progression";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

describe("progression state", () => {
  let sqlite: Awaited<ReturnType<typeof setupUserDb>>["sqlite"];

  beforeEach(async () => {
    ({ sqlite } = await setupUserDb());
  });

  afterEach(() => sqlite.close());

  describe("apply and dismiss", () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO exercise_progression_state
          (user_workout_exercise_id, suggestion_action, rule_key, rule_explanation)
        VALUES (1, 'increase_load', 'r', 'e'), (2, 'increase_load', 'r', 'e');
      `);
    });

    const flags = () =>
      sqlite
        .prepare(
          `SELECT user_workout_exercise_id AS id, is_applied, is_dismissed
           FROM exercise_progression_state ORDER BY id`,
        )
        .all();

    it("marks only the given exercise as applied", async () => {
      await applyProgressionToExercise(1);

      expect(flags()).toEqual([
        { id: 1, is_applied: 1, is_dismissed: 0 },
        { id: 2, is_applied: 0, is_dismissed: 0 },
      ]);
    });

    it("marks only the given exercise as dismissed", async () => {
      await dismissProgressionState(2);

      expect(flags()).toEqual([
        { id: 1, is_applied: 0, is_dismissed: 0 },
        { id: 2, is_applied: 0, is_dismissed: 1 },
      ]);
    });
  });

  it("stores and clears the deload week per plan", async () => {
    await setDeloadWeek(3, "2026-W43");
    await setDeloadWeek(4, "2026-W40");
    expect(await getDeloadWeek(3)).toBe("2026-W43");

    await setDeloadWeek(3, null);
    expect(await getDeloadWeek(3)).toBeNull();
    expect(await getDeloadWeek(4)).toBe("2026-W40");
  });

  describe("getPendingRecoveryCheckIns", () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT OR IGNORE INTO muscles (muscle) VALUES ('pectorals');
        INSERT INTO exercises (exercise_id, name, target_muscle)
        VALUES (100, 'Bench Press', 'pectorals');
        INSERT INTO user_workouts (id, name) VALUES (10, 'Push'), (11, 'Pull');
        INSERT INTO user_workout_exercises (id, workout_id, exercise_id, is_deleted)
        VALUES (1, 10, 100, 0), (2, 10, 100, 0), (3, 10, 100, 0),
               (4, 10, 100, 0), (5, 10, 100, 1), (6, 11, 100, 0);
        INSERT INTO exercise_feedback
          (id, user_workout_exercise_id, effort_rating, performance_ratio, created_at)
        VALUES (1, 1, 'hard', 1, datetime('now', '-13 hours')),
               (2, 2, 'hard', 1, datetime('now', '-11 hours')),
               (3, 3, 'hard', 1, datetime('now', '-13 hours')),
               (4, 4, 'hard', 1, datetime('now', '-13 hours')),
               (5, 5, 'hard', 1, datetime('now', '-13 hours')),
               (6, 6, 'hard', 1, datetime('now', '-13 hours'));
        INSERT INTO exercise_progression_state
          (user_workout_exercise_id, suggestion_action, rule_key,
           rule_explanation, source_feedback_id, is_dismissed, recovery_rating)
        VALUES (1, 'increase_load', 'r', 'e', 1, 0, NULL),
               (2, 'increase_load', 'r', 'e', 2, 0, NULL),
               (3, 'increase_load', 'r', 'e', 3, 1, NULL),
               (4, 'increase_load', 'r', 'e', 4, 0, 'fresh'),
               (5, 'increase_load', 'r', 'e', 5, 0, NULL),
               (6, 'increase_load', 'r', 'e', 6, 0, NULL);
      `);
    });

    it("returns only states whose feedback is over 12 hours old and still open", async () => {
      expect(await getPendingRecoveryCheckIns(10)).toEqual([
        {
          userWorkoutExerciseId: 1,
          exerciseId: 100,
          targetMuscle: "pectorals",
        },
      ]);
    });
  });
});
