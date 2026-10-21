import { setupUserDb } from "@/utils/db/testing/setupUserDb";
import {
  fetchAppExerciseIds,
  fetchBodyMeasurementEntryForSharing,
  fetchCompletedWorkoutExerciseIds,
  fetchCompletedWorkoutForSharing,
  fetchFullPlanForSharing,
} from "@/utils/db/sharingQueries";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

describe("sharing queries", () => {
  let sqlite: Awaited<ReturnType<typeof setupUserDb>>["sqlite"];

  beforeEach(async () => {
    ({ sqlite } = await setupUserDb());
    sqlite.exec(`
      INSERT INTO exercises (exercise_id, app_exercise_id, name, tracking_type)
      VALUES (100, 5100, 'Bench Press', 'weight'),
             (200, 5200, 'Squat', 'weight'),
             (300, NULL, 'My Curl', 'weight'),
             (400, 5400, 'Pull-up', 'reps');
    `);
  });

  afterEach(() => sqlite.close());

  describe("fetchFullPlanForSharing", () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO user_plans (id, name) VALUES (1, 'Plan'), (2, 'Gone');
        UPDATE user_plans SET is_deleted = TRUE WHERE id = 2;
        INSERT INTO user_workouts (id, plan_id, name, workout_order, is_deleted)
        VALUES (12, 1, 'Pull', 2, FALSE),
               (11, 1, 'Push', 1, FALSE),
               (13, 1, 'Empty', 3, FALSE),
               (14, 1, 'Deleted Day', 0, TRUE);
        INSERT INTO user_workout_exercises
          (id, workout_id, exercise_id, sets, exercise_order, is_deleted,
           superset_group_id, tracking_type_override)
        VALUES (1, 11, 200, '[]', 2, FALSE, 'g', NULL),
               (2, 11, 100, '[]', 1, FALSE, 'g', NULL),
               (3, 11, 300, '[]', 0, TRUE, NULL, NULL),
               (4, 12, 400, '[]', 0, FALSE, NULL, 'weight');
      `);
    });

    it("returns null for a deleted or unknown plan", async () => {
      expect(await fetchFullPlanForSharing(2)).toBeNull();
      expect(await fetchFullPlanForSharing(99)).toBeNull();
    });

    it("leaves out deleted workouts and deleted exercise rows", async () => {
      const result = await fetchFullPlanForSharing(1);

      expect(result!.workouts.map((w) => w.workout_name)).not.toContain(
        "Deleted Day",
      );
      const push = result!.workouts.find((w) => w.workout_id === 11)!;
      expect(push.exercises.map((e) => e.exercise_id)).not.toContain(300);
    });

    it("lists a workout with no exercises", async () => {
      const result = await fetchFullPlanForSharing(1);

      const empty = result!.workouts.find((w) => w.workout_id === 13)!;
      expect(empty.exercises).toEqual([]);
    });

    it("orders workouts and exercises by their order columns", async () => {
      const result = await fetchFullPlanForSharing(1);

      expect(result!.workouts.map((w) => w.workout_name)).toEqual([
        "Push",
        "Pull",
        "Empty",
      ]);
      expect(result!.workouts[0].exercises.map((e) => e.exercise_id)).toEqual([
        100, 200,
      ]);
    });

    it("passes through the superset group and tracking override", async () => {
      const result = await fetchFullPlanForSharing(1);

      const [push, pull] = result!.workouts;
      expect(push.exercises.map((e) => e.superset_group_id)).toEqual([
        "g",
        "g",
      ]);
      expect(pull.exercises[0].tracking_type_override).toBe("weight");
      expect(pull.exercises[0].app_exercise_id).toBe(5400);
    });
  });

  describe("fetchCompletedWorkoutForSharing", () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO completed_workouts
          (id, date_completed, local_date, duration, total_sets_completed, is_deleted)
        VALUES (1, '2026-10-10T08:00:00.000Z', '2026-10-10', 600, 3, 0),
               (2, '2026-10-11T08:00:00.000Z', '2026-10-11', 600, 1, 1);
        INSERT INTO completed_exercises (id, completed_workout_id, exercise_id, is_deleted)
        VALUES (10, 1, 100, 0), (20, 1, 200, 1), (30, 2, 100, 0);
        INSERT INTO completed_sets (id, completed_exercise_id, set_number, weight, reps, is_deleted)
        VALUES (13, 10, 3, 60, 8, 0),
               (11, 10, 1, 60, 10, 0),
               (12, 10, 2, 60, 9, 1),
               (21, 20, 1, 100, 5, 0),
               (31, 30, 1, 60, 10, 0);
      `);
    });

    it("returns null for a deleted session", async () => {
      expect(await fetchCompletedWorkoutForSharing(2)).toBeNull();
    });

    it("leaves out deleted exercises and sets, ordered by set number", async () => {
      const result = await fetchCompletedWorkoutForSharing(1);

      expect(result!.exercises.map((e) => e.completed_exercise_id)).toEqual([
        10,
      ]);
      expect(result!.exercises[0].sets.map((s) => s.set_number)).toEqual([
        1, 3,
      ]);
    });

    it("lists the session's exercise ids", async () => {
      expect((await fetchCompletedWorkoutExerciseIds(1)).sort()).toEqual([
        100, 200,
      ]);
    });
  });

  describe("fetchBodyMeasurementEntryForSharing", () => {
    it("returns null for an unknown entry", async () => {
      expect(await fetchBodyMeasurementEntryForSharing(99)).toBeNull();
    });

    it("returns the entry with each value keyed by its metric", async () => {
      sqlite.exec(`
        INSERT INTO body_measurement_entries (id, recorded_at, local_date)
        VALUES (1, '2026-10-10T08:00:00.000Z', '2026-10-10');
        INSERT INTO body_measurement_values (entry_id, metric_id, value)
        SELECT 1, id, 82 FROM body_metric_definitions WHERE key = 'weight';
        INSERT INTO body_measurement_values (entry_id, metric_id, value)
        SELECT 1, id, 90 FROM body_metric_definitions WHERE key = 'waist';
      `);

      expect(await fetchBodyMeasurementEntryForSharing(1)).toEqual({
        id: 1,
        recorded_at: "2026-10-10T08:00:00.000Z",
        values: { weight: 82, waist: 90 },
      });
    });
  });

  it("gives the library id of library exercises and null for custom ones", async () => {
    const rows = await fetchAppExerciseIds([100, 300]);

    expect(rows.sort((a, b) => a.exercise_id - b.exercise_id)).toEqual([
      { exercise_id: 100, app_exercise_id: 5100 },
      { exercise_id: 300, app_exercise_id: null },
    ]);
  });
});
