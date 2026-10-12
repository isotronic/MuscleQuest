import { useLogPastWorkoutMutation } from "../useLogPastWorkoutMutation";
import { useSaveCompletedWorkoutMutation } from "../useSaveCompletedWorkoutMutation";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import { runMigrations } from "@/utils/db/runMigrations";
import { openDatabase } from "@/utils/db/connection";
import { useMutation } from "@tanstack/react-query";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import { syncCompletedWorkoutChanged } from "@/utils/sharedSync";
import { FutureWorkoutDateError } from "@/utils/db/historyEdits";
import type { EditableWorkout } from "@/utils/historyEditOps";
import { toLocalDateKey } from "@/utils/dates";
import { DEFAULT_WEEK_RULE, weekStartKeyFor } from "@/utils/week";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return {
    AuthContext: React.createContext(null),
    waitForAuthUser: jest.fn().mockResolvedValue(null),
  };
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({ privacySettings: null })),
}));
jest.mock("@/utils/sharing", () => ({
  pushCompletedWorkout: jest.fn(),
  pushStrengthPRs: jest.fn(),
  fetchPrivacySettings: jest.fn(),
}));
jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));
// The live save imports through the barrel; give it the real function.
jest.mock("@/utils/database", () => ({
  saveCompletedWorkout: jest.requireActual("@/utils/db/workouts")
    .saveCompletedWorkout,
}));
jest.mock("@/utils/sharedSync", () => ({
  syncCompletedWorkoutChanged: jest.fn(),
}));
jest.mock("@/utils/progressionRecompute", () => ({
  refreshProgressionAfterHistoryChange: jest.fn(),
}));
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ decimalSeparator: ".", languageTag: "en-US" }],
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

type Row = Record<string, unknown>;

// Built from a local moment so the training day holds in every timezone.
const LAST_TUESDAY = new Date(2026, 8, 29, 19, 30);

const logged = (): EditableWorkout => ({
  completedAt: LAST_TUESDAY,
  durationSeconds: 2700,
  notes: "Late entry",
  exercises: [
    {
      completed_exercise_id: -1,
      exercise_id: 100,
      exercise_name: "Bench Press",
      exercise_tracking_type: "weight",
      sets: [
        {
          set_id: -2,
          set_number: 1,
          weight: 135,
          reps: 10,
          time: null,
          distance: null,
          is_warmup: true,
          set_duration: null,
        },
        {
          set_id: -3,
          set_number: 2,
          weight: 185.5,
          reps: 5,
          time: null,
          distance: null,
          is_warmup: false,
          is_to_failure: true,
          set_duration: null,
          note: "last rep slow",
        },
      ],
    },
    {
      completed_exercise_id: -4,
      exercise_id: 200,
      exercise_name: "Row",
      exercise_tracking_type: "distance",
      sets: [
        {
          set_id: -5,
          set_number: 1,
          weight: null,
          reps: null,
          time: null,
          distance: 1.2,
          is_warmup: false,
          set_duration: null,
        },
      ],
    },
  ],
});

describe("useLogPastWorkoutMutation", () => {
  let sqlite: ReturnType<typeof createNodeSqliteDb>["sqlite"];
  const mutationFns: Record<string, (vars: any) => Promise<number>> = {};
  const callbacks: Record<string, any> = {};

  const rows = (sql: string, ...params: any[]): Row[] =>
    sqlite.prepare(sql).all(...params) as Row[];

  /** Everything saved for one completed workout, without row ids. */
  const saved = (id: number) => ({
    workout: rows(
      `SELECT plan_id, workout_id, date_completed, local_date, duration,
              total_sets_completed, is_deload, notes
       FROM completed_workouts WHERE id = ?`,
      id,
    ),
    exercises: rows(
      `SELECT exercise_id, resolved_tracking_type FROM completed_exercises
       WHERE completed_workout_id = ? ORDER BY id`,
      id,
    ),
    sets: rows(
      `SELECT ce.exercise_id, cs.set_number, cs.weight, cs.reps, cs.time,
              cs.distance, cs.is_warmup, cs.is_drop_set, cs.is_to_failure,
              cs.set_duration, cs.note
       FROM completed_sets cs
       JOIN completed_exercises ce ON ce.id = cs.completed_exercise_id
       WHERE ce.completed_workout_id = ? ORDER BY ce.id, cs.set_number`,
      id,
    ),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const created = createNodeSqliteDb();
    sqlite = created.sqlite;
    await runMigrations(created.db);
    (openDatabase as jest.Mock).mockResolvedValue(created.db);
    sqlite.exec(`
      INSERT INTO user_plans (id, name) VALUES (1, 'Plan');
      INSERT INTO user_workouts (id, plan_id, name) VALUES (2, 1, 'Push');
      INSERT INTO exercises (exercise_id, name, tracking_type)
      VALUES (100, 'Bench Press', 'weight'), (200, 'Row', 'distance');
    `);
    (useMutation as jest.Mock).mockImplementation((args) => {
      const key =
        (useMutation as jest.Mock).mock.calls.length === 1 ? "log" : "live";
      mutationFns[key] = args.mutationFn;
      callbacks[key] = args;
      return { mutate: jest.fn() };
    });
    useLogPastWorkoutMutation("lbs", "km");
    useSaveCompletedWorkoutMutation("lbs", "km");
  });

  it("writes the same rows as a live save of the same session", async () => {
    const workout = logged();
    const logId = await mutationFns.log({
      workout,
      source: { planId: 1, workoutId: 2 },
    });
    const liveId = await mutationFns.live({
      planId: 1,
      workoutId: 2,
      duration: workout.durationSeconds,
      totalSetsCompleted: 3,
      completedAt: workout.completedAt,
      notes: workout.notes,
      exercises: workout.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        resolved_tracking_type: exercise.exercise_tracking_type,
        sets: exercise.sets.map((set) => ({
          set_number: set.set_number,
          weight: set.weight,
          reps: set.reps,
          time: set.time,
          distance: set.distance,
          is_warmup: set.is_warmup,
          is_drop_set: !!set.is_drop_set,
          is_to_failure: !!set.is_to_failure,
          note: set.note ?? null,
        })),
      })),
    });

    expect(logId).not.toBe(liveId);
    expect(saved(logId)).toEqual(saved(liveId));
    expect(saved(logId).workout[0]).toMatchObject({
      workout_id: 2,
      local_date: toLocalDateKey(LAST_TUESDAY),
    });
  });

  it("counts the new day in a week already recorded", async () => {
    const week = weekStartKeyFor(
      toLocalDateKey(LAST_TUESDAY),
      DEFAULT_WEEK_RULE,
    );
    sqlite
      .prepare(
        `INSERT INTO weekly_completions (week_start, goal, completed, goal_reached)
         VALUES (?, 1, 0, 0)`,
      )
      .run(week);

    await mutationFns.log({ workout: logged(), source: null });

    expect(
      rows(`SELECT completed, goal_reached FROM weekly_completions`),
    ).toEqual([{ completed: 1, goal_reached: 1 }]);
  });

  it("refuses a finish time still to come and saves nothing", async () => {
    const workout = {
      ...logged(),
      completedAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };
    await expect(
      mutationFns.log({ workout, source: null }),
    ).rejects.toBeInstanceOf(FutureWorkoutDateError);
    expect(rows(`SELECT id FROM completed_workouts`)).toEqual([]);
  });

  it("refreshes progression and shares the new session", () => {
    callbacks.log.onSuccess(77);
    expect(refreshProgressionAfterHistoryChange).toHaveBeenCalledWith(
      expect.anything(),
      77,
    );
    expect(syncCompletedWorkoutChanged).toHaveBeenCalledWith(77);
  });
});
