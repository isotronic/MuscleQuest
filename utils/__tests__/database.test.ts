import * as SQLite from "expo-sqlite";
import Bugsnag from "@bugsnag/expo";
import {
  fetchActivePlan,
  updateActivePlan,
  fetchSettings,
  updateSettings,
  deleteCompletedWorkout,
  restoreCompletedWorkout,
  deleteWorkoutPlan,
  restoreWorkoutPlan,
  deleteStandaloneWorkout,
  restoreStandaloneWorkout,
  saveCompletedWorkout,
  fetchPlanSchedule,
  fetchActiveBodyMetricDefinitions,
  fetchAllBodyMetricDefinitions,
  reorderTrackedExercises,
  fetchAllPlanIds,
  fetchAllStandaloneWorkoutIds,
  fetchAllCustomExercisesForSharing,
  upsertProgressionState,
  getDaysSinceLastWorkoutByMuscle,
  getProgressionState,
  getProgressionStatesForWorkout,
  updateAppExerciseIds,
  syncExerciseFlagsFromAppData,
  copyDataFromAppDataToUserData,
  updatePlanWorkoutExercises,
  updateStandaloneWorkout,
  fetchBodyMeasurementSessions,
  insertBodyMeasurementSession,
  fetchBodyMeasurementSessionsForChart,
  saveBodyWeightMeasurement,
  fetchLatestBodyMetricValues,
  fetchCompletedWorkoutById,
  createDatabaseSnapshot,
  checkDatabaseIntegrity,
  openDatabase,
} from "../database";
import { ProgressionRuleResult } from "@/types/progression";
import { parseDbTimestamp, toLocalDateKey } from "@/utils/dates";
import { displayToKg, roundCanonical } from "@/utils/units";

// Undo the global mock from jestSetupFile.js so we can test the real implementation
jest.unmock("@/utils/database");

// Break circular dependency: database.ts imports CompletedWorkout type from useCompletedWorkoutsQuery
jest.mock("@/hooks/useCompletedWorkoutsQuery", () => ({}));
// Break circular dependency: database.ts imports UserExercise/Workout from workoutStore, which imports Exercise from database
jest.mock("@/store/workoutStore", () => ({}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Shared mock DB factory
// ---------------------------------------------------------------------------

const makeDb = (overrides: Record<string, jest.Mock> = {}) => ({
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  execAsync: jest.fn().mockResolvedValue(undefined),
  closeAsync: jest.fn().mockResolvedValue(undefined),
  withExclusiveTransactionAsync: jest.fn(
    async (cb: (txn: any) => Promise<void>) => {
      const txn = {
        runAsync: jest
          .fn()
          .mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      };
      await cb(txn);
    },
  ),
  ...overrides,
});

let mockDb = makeDb();

// What expo-sqlite hands back for the current mockDb. openDatabase wraps
// withExclusiveTransactionAsync on the handle it is given, so each open gets
// its own object and assertions keep pointing at mockDb's jest.fns. A real
// transaction handle always has execAsync; the partial ones these tests pass
// in mostly do not, so one is supplied.
const openMockDb = async () => {
  const db = mockDb;
  return {
    ...db,
    withExclusiveTransactionAsync: (task: (txn: any) => Promise<void>) =>
      db.withExclusiveTransactionAsync((txn: any) =>
        task({ execAsync: jest.fn(), ...txn }),
      ),
  };
};

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = makeDb();
  (SQLite.openDatabaseAsync as jest.Mock).mockImplementation(openMockDb);
});

// ---------------------------------------------------------------------------
// fetchActivePlan
// ---------------------------------------------------------------------------

describe("fetchActivePlan", () => {
  it("returns the active plan row when one exists", async () => {
    const plan = { id: 1, name: "My Plan", is_active: 1 };
    mockDb.getFirstAsync.mockResolvedValue(plan);

    const result = await fetchActivePlan();

    expect(result).toEqual(plan);
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("is_active = true"),
    );
  });

  it("returns null when no active plan exists", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await fetchActivePlan();

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateActivePlan
// ---------------------------------------------------------------------------

describe("updateActivePlan", () => {
  it("deactivates current plan then activates the given id", async () => {
    await updateActivePlan(5);

    expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    // First call sets all to false
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("is_active = false"),
    );
    // Second call sets the target id to true
    expect(mockDb.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("is_active = true"),
      [5],
    );
  });
});

// ---------------------------------------------------------------------------
// fetchSettings
// ---------------------------------------------------------------------------

describe("fetchSettings", () => {
  it("returns a Settings object from key/value rows", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { key: "weightUnit", value: "kg" },
      { key: "weeklyGoal", value: "4" },
      { key: "bodyWeight", value: "80" },
    ]);

    const settings = await fetchSettings();

    expect(settings.weightUnit).toBe("kg");
    expect(settings.weeklyGoal).toBe("4");
    expect(settings.bodyWeight).toBe("80");
  });

  it("converts bodyWeight from kg to lbs when weightUnit is lbs", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { key: "weightUnit", value: "lbs" },
      { key: "bodyWeight", value: "100" }, // 100 kg
    ]);

    const settings = await fetchSettings();

    // 100 kg is 220.46 lbs, shown to 1 decimal
    expect(settings.bodyWeight).toBe("220.5");
  });

  it("round-trips a body weight entered in lbs", async () => {
    // What settings.tsx stores for a 180 lbs entry.
    const stored = roundCanonical(displayToKg(180, "lbs"));
    mockDb.getAllAsync.mockResolvedValue([
      { key: "weightUnit", value: "lbs" },
      { key: "bodyWeight", value: stored.toString() },
    ]);

    const settings = await fetchSettings();

    expect(settings.bodyWeight).toBe("180.0");
  });

  it("shows a kg body weight to one decimal", async () => {
    // 180 lbs stored, then the user switched to kg.
    mockDb.getAllAsync.mockResolvedValue([
      { key: "weightUnit", value: "kg" },
      { key: "bodyWeight", value: "81.647" },
    ]);

    const settings = await fetchSettings();

    expect(settings.bodyWeight).toBe("81.6");
  });

  it("throws and notifies Bugsnag on database error", async () => {
    const error = new Error("db failure");
    mockDb.getAllAsync.mockRejectedValue(error);

    await expect(fetchSettings()).rejects.toThrow("db failure");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// updateSettings
// ---------------------------------------------------------------------------

describe("updateSettings", () => {
  it("runs an INSERT OR REPLACE with the correct key/value", async () => {
    await updateSettings("weeklyGoal", "5");

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO settings"),
      ["weeklyGoal", "5"],
    );
  });

  it("throws and notifies Bugsnag on database error", async () => {
    const error = new Error("write failed");
    mockDb.runAsync.mockRejectedValue(error);

    await expect(updateSettings("key", "value")).rejects.toThrow(
      "write failed",
    );
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// deleteCompletedWorkout
// ---------------------------------------------------------------------------

describe("deleteCompletedWorkout", () => {
  it("soft-deletes sets, exercises, and workout in a transaction", async () => {
    await deleteCompletedWorkout(42);

    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);

    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("soft-deletes cascade runs three SQL statements", async () => {
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await deleteCompletedWorkout(42);

    expect(txnRunAsync).toHaveBeenCalledTimes(3);
    expect(txnRunAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("completed_sets"),
      [42],
    );
    expect(txnRunAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("completed_exercises"),
      [42],
    );
    expect(txnRunAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("completed_workouts"),
      [42],
    );
  });

  it("propagates when the transaction fails", async () => {
    const error = new Error("transaction failed");
    mockDb.withExclusiveTransactionAsync.mockRejectedValue(error);

    await expect(deleteCompletedWorkout(42)).rejects.toBe(error);
  });
});

// ---------------------------------------------------------------------------
// deleteWorkoutPlan / restoreWorkoutPlan
// ---------------------------------------------------------------------------

describe("deleteWorkoutPlan", () => {
  it("returns the ids of the rows it deleted, leaving earlier deletions out", async () => {
    const txnGetAllAsync = jest
      .fn()
      .mockResolvedValueOnce([{ id: 10 }, { id: 11 }]) // live workouts
      .mockResolvedValueOnce([{ id: 100 }, { id: 101 }, { id: 110 }]); // live exercises
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync, getAllAsync: txnGetAllAsync });
      },
    );

    const snapshot = await deleteWorkoutPlan(7);

    expect(txnGetAllAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/FROM user_workouts[\s\S]*is_deleted = FALSE/),
      [7],
    );
    expect(txnGetAllAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /FROM user_workout_exercises[\s\S]*is_deleted = FALSE/,
      ),
      [7],
    );
    expect(snapshot).toEqual({
      planId: 7,
      workoutIds: [10, 11],
      workoutExerciseIds: [100, 101, 110],
    });
  });
});

describe("restoreWorkoutPlan", () => {
  it("clears is_deleted only on the plan and the rows the delete touched", async () => {
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await restoreWorkoutPlan({
      planId: 7,
      workoutIds: [10, 11],
      workoutExerciseIds: [100, 101, 110],
    });

    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_plans SET is_deleted = FALSE WHERE id = \?/,
      ),
      [7],
    );
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_workouts SET is_deleted = FALSE WHERE id IN \(\?, \?\)/,
      ),
      [10, 11],
    );
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_workout_exercises SET is_deleted = FALSE WHERE id IN \(\?, \?, \?\)/,
      ),
      [100, 101, 110],
    );
  });

  it("skips empty id lists", async () => {
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await restoreWorkoutPlan({
      planId: 7,
      workoutIds: [],
      workoutExerciseIds: [],
    });

    expect(txnRunAsync).toHaveBeenCalledTimes(1);
  });
});

describe("deleteStandaloneWorkout", () => {
  it("returns the live exercise rows it deleted", async () => {
    const txnGetAllAsync = jest.fn().mockResolvedValue([{ id: 5 }, { id: 6 }]);
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync, getAllAsync: txnGetAllAsync });
      },
    );

    const snapshot = await deleteStandaloneWorkout(99);

    expect(txnGetAllAsync).toHaveBeenCalledWith(
      expect.stringMatching(/is_deleted = FALSE/),
      [99],
    );
    expect(snapshot).toEqual({ workoutId: 99, workoutExerciseIds: [5, 6] });
  });
});

describe("restoreStandaloneWorkout", () => {
  it("clears is_deleted on the workout and only the recorded exercises", async () => {
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await restoreStandaloneWorkout({
      workoutId: 99,
      workoutExerciseIds: [5, 6],
    });

    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_workouts SET is_deleted = FALSE WHERE id = \?/,
      ),
      [99],
    );
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE user_workout_exercises SET is_deleted = FALSE WHERE id IN \(\?, \?\)/,
      ),
      [5, 6],
    );
  });
});

// ---------------------------------------------------------------------------
// restoreCompletedWorkout
// ---------------------------------------------------------------------------

describe("restoreCompletedWorkout", () => {
  it("clears the soft-delete on the workout, its exercises and sets in one transaction", async () => {
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await restoreCompletedWorkout(42);

    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(txnRunAsync).toHaveBeenCalledTimes(3);
    for (const table of [
      "completed_workouts",
      "completed_exercises",
      "completed_sets",
    ]) {
      expect(txnRunAsync).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`UPDATE ${table} SET is_deleted = FALSE`),
        ),
        [42],
      );
    }
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// saveCompletedWorkout
// ---------------------------------------------------------------------------

describe("saveCompletedWorkout", () => {
  it("wraps the whole save in a single exclusive transaction", async () => {
    const exercises = [
      {
        exercise_id: 1,
        resolved_tracking_type: "weight",
        sets: [
          {
            set_number: 1,
            weight: 100,
            reps: 8,
            time: null,
            distance: null,
          },
        ],
      },
    ];

    await saveCompletedWorkout(1, 2, 600, 1, false, exercises);

    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.execAsync).not.toHaveBeenCalledWith("BEGIN TRANSACTION");
  });

  it("runs one insert for the workout, one per exercise, one per set", async () => {
    const txnRunAsync = jest
      .fn()
      .mockResolvedValue({ lastInsertRowId: 7, changes: 1 });
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    const exercises = [
      {
        exercise_id: 1,
        sets: [
          { set_number: 1, weight: 100, reps: 8, time: null, distance: null },
          { set_number: 2, weight: 100, reps: 7, time: null, distance: null },
        ],
      },
    ];

    const id = await saveCompletedWorkout(1, 2, 600, 2, false, exercises);

    expect(id).toBe(7);
    // 1 completed_workouts insert + 1 completed_exercises insert + 2 completed_sets inserts
    expect(txnRunAsync).toHaveBeenCalledTimes(4);
    expect(txnRunAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO completed_workouts"),
      expect.any(Array),
    );
  });

  it("propagates and does not swallow errors from within the transaction", async () => {
    const error = new Error("disk full");
    mockDb.withExclusiveTransactionAsync.mockRejectedValue(error);

    await expect(saveCompletedWorkout(1, 2, 600, 1, false, [])).rejects.toBe(
      error,
    );
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// local_date on new writes
// ---------------------------------------------------------------------------

describe("local_date on new writes", () => {
  it("writes date_completed as an unambiguous UTC instant plus the local training day", async () => {
    const txnRunAsync = jest
      .fn()
      .mockResolvedValue({ lastInsertRowId: 7, changes: 1 });
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync });
      },
    );

    await saveCompletedWorkout(1, 2, 600, 0, false, []);

    const [sql, params] = txnRunAsync.mock.calls[0];
    expect(sql).toContain("local_date");
    expect(sql).not.toContain("datetime('now')");
    const dateCompleted = params[2] as string;
    const localDate = params[3] as string;
    expect(dateCompleted).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(localDate).toBe(toLocalDateKey(parseDbTimestamp(dateCompleted)));
  });

  it("stores the local training day of a body measurement session", async () => {
    const txnRunAsync = jest
      .fn()
      .mockResolvedValue({ lastInsertRowId: 3, changes: 1 });
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ runAsync: txnRunAsync, getFirstAsync: jest.fn() });
      },
    );

    // 22:30 UTC: a different calendar day east of UTC+2.
    await insertBodyMeasurementSession("2026-08-13T22:30:00.000Z", []);

    const [sql, params] = txnRunAsync.mock.calls[0];
    expect(sql).toContain("INSERT INTO body_measurement_entries");
    expect(sql).toContain("local_date");
    expect(params[1]).toBe(
      toLocalDateKey(parseDbTimestamp("2026-08-13T22:30:00.000Z")),
    );
  });

  it("stores the local training day of a quick body weight log", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 5 });

    await saveBodyWeightMeasurement(80);

    const entryInsert = mockDb.runAsync.mock.calls.find(([sql]: [string]) =>
      sql.includes("INSERT INTO body_measurement_entries"),
    );
    expect(entryInsert).toBeDefined();
    expect(entryInsert![0]).toContain("local_date");
    const [recordedAt, localDate] = entryInsert![1] as string[];
    expect(localDate).toBe(toLocalDateKey(parseDbTimestamp(recordedAt)));
  });
});

describe("fetchBodyMeasurementSessionsForChart", () => {
  it("returns each point's stored local_date so the chart buckets by the day it was logged", async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 1,
      key: "waist",
      label: "Waist",
      value_kind: "length",
      is_builtin: 1,
      is_active: 1,
      is_deleted: 0,
      sort_order: 0,
    });
    mockDb.getAllAsync.mockResolvedValue([
      {
        recorded_at: "2026-05-18T10:00:00.000Z",
        local_date: "2026-05-17",
        value: 80,
      },
    ]);

    const points = await fetchBodyMeasurementSessionsForChart(1, {
      weightUnit: "kg",
      sizeUnit: "cm",
    } as any);

    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain("local_date");
    expect(points[0].local_date).toBe("2026-05-17");
  });
});

// ---------------------------------------------------------------------------
// fetchPlanSchedule
// ---------------------------------------------------------------------------

describe("fetchPlanSchedule", () => {
  it("returns an array of schedule entries for a plan", async () => {
    const entries = [
      { day_of_week: 0, workout_id: 10 },
      { day_of_week: 2, workout_id: 11 },
    ];
    mockDb.getAllAsync.mockResolvedValue(entries);

    const result = await fetchPlanSchedule(3);

    expect(result).toEqual(entries);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.any(String), [3]);
  });

  it("returns empty array when no schedule entries exist", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await fetchPlanSchedule(99);

    expect(result).toEqual([]);
  });

  it("throws and notifies Bugsnag on error", async () => {
    const error = new Error("schedule fetch failed");
    mockDb.getAllAsync.mockRejectedValue(error);

    await expect(fetchPlanSchedule(1)).rejects.toThrow("schedule fetch failed");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// fetchActiveBodyMetricDefinitions
// ---------------------------------------------------------------------------

const makeRawMetricRow = (overrides = {}) => ({
  id: 1,
  key: "weight",
  label: "Body Weight",
  value_kind: "mass",
  is_builtin: 1,
  is_active: 1,
  is_deleted: 0,
  sort_order: 0,
  ...overrides,
});

describe("fetchActiveBodyMetricDefinitions", () => {
  it("returns mapped BodyMetricDefinition objects", async () => {
    mockDb.getAllAsync.mockResolvedValue([makeRawMetricRow()]);

    const result = await fetchActiveBodyMetricDefinitions();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      key: "weight",
      label: "Body Weight",
      value_kind: "mass",
      is_builtin: true,
      is_active: true,
      is_deleted: false,
      sort_order: 0,
    });
  });

  it("returns empty array when no definitions exist", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const result = await fetchActiveBodyMetricDefinitions();

    expect(result).toEqual([]);
  });

  it("throws and notifies Bugsnag on error", async () => {
    const error = new Error("metric fetch failed");
    mockDb.getAllAsync.mockRejectedValue(error);

    await expect(fetchActiveBodyMetricDefinitions()).rejects.toThrow(
      "metric fetch failed",
    );
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// fetchAllBodyMetricDefinitions
// ---------------------------------------------------------------------------

describe("fetchAllBodyMetricDefinitions", () => {
  it("maps rows including inactive and deleted ones", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeRawMetricRow({ id: 1, is_active: 1, is_deleted: 0 }),
      makeRawMetricRow({ id: 2, is_active: 0, is_deleted: 0, sort_order: 1 }),
    ]);

    const result = await fetchAllBodyMetricDefinitions();

    expect(result).toHaveLength(2);
    expect(result[1].is_active).toBe(false);
  });

  it("throws and notifies Bugsnag on error", async () => {
    const error = new Error("all metrics failed");
    mockDb.getAllAsync.mockRejectedValue(error);

    await expect(fetchAllBodyMetricDefinitions()).rejects.toThrow(
      "all metrics failed",
    );
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// reorderTrackedExercises
// ---------------------------------------------------------------------------

describe("reorderTrackedExercises", () => {
  it("updates sort_order for each exercise ID in the given order", async () => {
    const txn = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }) };
    mockDb = makeDb({
      withExclusiveTransactionAsync: jest.fn(
        async (cb: (t: typeof txn) => Promise<void>) => {
          await cb(txn);
        },
      ),
    });
    (SQLite.openDatabaseAsync as jest.Mock).mockImplementation(openMockDb);

    await reorderTrackedExercises([3, 1, 2]);

    expect(txn.runAsync).toHaveBeenCalledTimes(3);
    expect(txn.runAsync).toHaveBeenNthCalledWith(
      1,
      `UPDATE tracked_exercises SET sort_order = ? WHERE exercise_id = ?`,
      [0, 3],
    );
    expect(txn.runAsync).toHaveBeenNthCalledWith(
      2,
      `UPDATE tracked_exercises SET sort_order = ? WHERE exercise_id = ?`,
      [1, 1],
    );
    expect(txn.runAsync).toHaveBeenNthCalledWith(
      3,
      `UPDATE tracked_exercises SET sort_order = ? WHERE exercise_id = ?`,
      [2, 2],
    );
  });

  it("does nothing when given an empty array", async () => {
    const txn = { runAsync: jest.fn().mockResolvedValue({ changes: 0 }) };
    mockDb = makeDb({
      withExclusiveTransactionAsync: jest.fn(
        async (cb: (t: typeof txn) => Promise<void>) => {
          await cb(txn);
        },
      ),
    });
    (SQLite.openDatabaseAsync as jest.Mock).mockImplementation(openMockDb);

    await reorderTrackedExercises([]);

    expect(txn.runAsync).not.toHaveBeenCalled();
    expect(mockDb.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it("propagates when the transaction fails", async () => {
    mockDb = makeDb({
      withExclusiveTransactionAsync: jest
        .fn()
        .mockRejectedValue(new Error("db error")),
    });
    (SQLite.openDatabaseAsync as jest.Mock).mockImplementation(openMockDb);

    await expect(reorderTrackedExercises([1])).rejects.toThrow("db error");
  });
});

// ---------------------------------------------------------------------------
// fetchAllPlanIds
// ---------------------------------------------------------------------------

describe("fetchAllPlanIds", () => {
  it("returns all non-deleted user-created plan IDs (excludes premade)", async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 1 }, { id: 3 }]);
    const result = await fetchAllPlanIds();
    expect(result).toEqual([1, 3]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("user_plans"),
    );
  });

  it("returns empty array when no plans", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await fetchAllPlanIds();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchAllStandaloneWorkoutIds
// ---------------------------------------------------------------------------

describe("fetchAllStandaloneWorkoutIds", () => {
  it("returns all non-deleted standalone workout IDs", async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 5 }, { id: 7 }]);
    const result = await fetchAllStandaloneWorkoutIds();
    expect(result).toEqual([5, 7]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("user_workouts"),
    );
  });

  it("returns empty array when no standalone workouts", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await fetchAllStandaloneWorkoutIds();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchAllCustomExercisesForSharing
// ---------------------------------------------------------------------------

describe("fetchAllCustomExercisesForSharing", () => {
  it("returns all custom exercises (app_exercise_id IS NULL)", async () => {
    const exercises = [
      {
        exercise_id: 10,
        name: "Custom Curl",
        app_exercise_id: null,
        equipment: "barbell",
        body_part: "arms",
        target_muscle: "biceps",
        secondary_muscles: "[]",
        description: null,
        tracking_type: "weight",
        is_unilateral: 0,
        double_weight: 0,
        animated_url: null,
        local_animated_uri: null,
        image: null,
        is_deleted: 0,
      },
    ];
    mockDb.getAllAsync.mockResolvedValue(exercises);
    const result = await fetchAllCustomExercisesForSharing();
    expect(result).toEqual(exercises);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("app_exercise_id IS NULL"),
    );
  });

  it("returns empty array when no custom exercises", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await fetchAllCustomExercisesForSharing();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// upsertProgressionState
// ---------------------------------------------------------------------------

describe("upsertProgressionState", () => {
  it("resets recovery_rating and recovery_checked_at to NULL when new feedback arrives for an exercise that already has a recovery answer", async () => {
    const result: ProgressionRuleResult = {
      action: "hold",
      ruleKey: "MODERATE_TARGET",
      explanation: "Solid session. Keep this load.",
    };

    await upsertProgressionState(42, result, 99, 1, {
      discomfortStreakCount: 0,
      consecutiveHoldCount: 1,
      plateauAdvisory: false,
      lastProgressionAt: null,
    });

    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain("recovery_rating = NULL");
    expect(sql).toContain("recovery_checked_at = NULL");
  });
});

// ---------------------------------------------------------------------------
// getDaysSinceLastWorkoutByMuscle
// ---------------------------------------------------------------------------

describe("getDaysSinceLastWorkoutByMuscle", () => {
  it("returns a map of target_muscle to days since last trained", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { target_muscle: "quads", days_since: 20 },
      { target_muscle: "pecs", days_since: 3 },
    ]);

    const result = await getDaysSinceLastWorkoutByMuscle();

    expect(result).toEqual({ quads: 20, pecs: 3 });
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("GROUP BY e.target_muscle"),
    );
  });

  it("returns an empty object when there is no completed workout history", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    const result = await getDaysSinceLastWorkoutByMuscle();
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getProgressionState — muscle-layoff override
// ---------------------------------------------------------------------------

describe("getProgressionState — muscle-layoff override", () => {
  const baseRow = {
    id: 1,
    user_workout_exercise_id: 42,
    suggestion_action: "increase_load",
    suggested_weight: 100,
    suggested_reps_per_set: null,
    suggested_sets: null,
    rule_key: "EASY_TARGET_LOAD",
    rule_explanation: "You've been hitting targets easily.",
    source_feedback_id: 7,
    recovery_rating: null,
    recovery_checked_at: null,
    consecutive_direction_count: 1,
    discomfort_streak_count: 0,
    consecutive_hold_count: 0,
    plateau_advisory: 0,
    last_progression_at: null,
    is_applied: 0,
    is_dismissed: 0,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    target_muscle: "quads",
    equipment: "barbell",
    tracking_type_override: null,
    tracking_type: "weight",
    recent_weight: 100,
  };

  function mockSettingsAndMuscleDays(daysByMuscle: Record<string, number>) {
    mockDb.getAllAsync.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY e.target_muscle")) {
        return Promise.resolve(
          Object.entries(daysByMuscle).map(([target_muscle, days_since]) => ({
            target_muscle,
            days_since,
          })),
        );
      }
      if (sql.includes("FROM settings")) {
        return Promise.resolve([
          { key: "adaptive_progression_enabled", value: "1" },
          { key: "progression_increment_barbell_kg", value: "2.5" },
        ]);
      }
      return Promise.resolve([]);
    });
  }

  it("overrides a stale suggestion with a reduce_load suggestion when the target muscle is stale", async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseRow);
    mockSettingsAndMuscleDays({ quads: 21 });

    const result = await getProgressionState(42);

    expect(result?.suggestionAction).toBe("reduce_load");
    // raw = 100 * 0.85 = 85, nearest multiple of 2.5 = 85
    expect(result?.suggestedWeight).toBe(85);
    expect(result?.ruleKey).toBe("MUSCLE_LAYOFF");
    expect(result?.suggestedRepsPerSet).toBeUndefined();
  });

  it("leaves the original suggestion untouched when the target muscle was trained recently", async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseRow);
    mockSettingsAndMuscleDays({ quads: 3 });

    const result = await getProgressionState(42);

    expect(result?.suggestionAction).toBe("increase_load");
    expect(result?.suggestedWeight).toBe(100);
    expect(result?.ruleKey).toBe("EASY_TARGET_LOAD");
  });

  it("skips the override entirely when skipLayoffOverride is true, even if the muscle is stale", async () => {
    mockDb.getFirstAsync.mockResolvedValue(baseRow);
    mockSettingsAndMuscleDays({ quads: 21 });

    const result = await getProgressionState(42, true);

    expect(result?.suggestionAction).toBe("increase_load");
    expect(result?.suggestedWeight).toBe(100);
  });

  it("does not override exercises with no recent working weight", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ ...baseRow, recent_weight: null });
    mockSettingsAndMuscleDays({ quads: 21 });

    const result = await getProgressionState(42);

    expect(result?.suggestionAction).toBe("increase_load");
  });

  it("excludes drop sets from the recent_weight lookup, mirroring getWorkingSets()", async () => {
    // A session with only drop sets has no recent_weight to compare against
    // under the working-set definition, so the layoff override can't fire on it.
    mockDb.getFirstAsync.mockResolvedValue({ ...baseRow, recent_weight: null });
    mockSettingsAndMuscleDays({ quads: 21 });

    await getProgressionState(42);

    const [sql] = mockDb.getFirstAsync.mock.calls[0];
    expect(sql).toContain("AND cs.is_drop_set = 0");
  });

  it("does not override reps-tracked exercises", async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      ...baseRow,
      tracking_type: "reps",
      tracking_type_override: null,
    });
    mockSettingsAndMuscleDays({ quads: 21 });

    const result = await getProgressionState(42);

    expect(result?.suggestionAction).toBe("increase_load");
  });

  it("returns null when there is no progression state row", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const result = await getProgressionState(42);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getProgressionStatesForWorkout — muscle-layoff override
// ---------------------------------------------------------------------------

describe("getProgressionStatesForWorkout — muscle-layoff override", () => {
  const quadsRow = {
    id: 1,
    user_workout_exercise_id: 42,
    exercise_name: "Squat",
    suggestion_action: "increase_load",
    suggested_weight: 100,
    suggested_reps_per_set: null,
    suggested_sets: null,
    rule_key: "EASY_TARGET_LOAD",
    rule_explanation: "You've been hitting targets easily.",
    consecutive_direction_count: 1,
    plateau_advisory: 0,
    last_progression_at: null,
    recovery_rating: null,
    is_applied: 0,
    is_dismissed: 0,
    target_muscle: "quads",
    equipment: "barbell",
    tracking_type_override: null,
    tracking_type: "weight",
    recent_weight: 100,
  };
  const pecsRow = {
    ...quadsRow,
    id: 2,
    user_workout_exercise_id: 43,
    exercise_name: "Bench Press",
    target_muscle: "pecs",
    suggested_weight: 60,
    recent_weight: 60,
  };

  function mockSettingsAndMuscleDays(
    statesRows: object[],
    daysByMuscle: Record<string, number>,
  ) {
    mockDb.getAllAsync.mockImplementation((sql: string) => {
      if (sql.includes("GROUP BY e.target_muscle")) {
        return Promise.resolve(
          Object.entries(daysByMuscle).map(([target_muscle, days_since]) => ({
            target_muscle,
            days_since,
          })),
        );
      }
      if (sql.includes("FROM settings")) {
        return Promise.resolve([
          { key: "adaptive_progression_enabled", value: "1" },
          { key: "progression_increment_barbell_kg", value: "2.5" },
        ]);
      }
      if (sql.includes("FROM exercise_progression_state")) {
        return Promise.resolve(statesRows);
      }
      return Promise.resolve([]);
    });
  }

  it("overrides only the exercise whose target muscle is stale, leaving others untouched", async () => {
    mockSettingsAndMuscleDays([quadsRow, pecsRow], { quads: 21, pecs: 3 });

    const result = await getProgressionStatesForWorkout(1);

    const quads = result.find((r) => r.userWorkoutExerciseId === 42);
    const pecs = result.find((r) => r.userWorkoutExerciseId === 43);
    expect(quads?.suggestionAction).toBe("reduce_load");
    expect(quads?.suggestedWeight).toBe(85);
    expect(pecs?.suggestionAction).toBe("increase_load");
    expect(pecs?.suggestedWeight).toBe(60);
  });

  it("skips the override entirely when skipLayoffOverride is true", async () => {
    mockSettingsAndMuscleDays([quadsRow], { quads: 21 });

    const result = await getProgressionStatesForWorkout(1, true);

    expect(result[0].suggestionAction).toBe("increase_load");
    expect(result[0].suggestedWeight).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// updateAppExerciseIds
// ---------------------------------------------------------------------------

describe("updateAppExerciseIds", () => {
  it("does not call ROLLBACK if the version check itself fails before any transaction starts", async () => {
    mockDb.getFirstAsync.mockRejectedValue(new Error("read failed"));

    await expect(updateAppExerciseIds()).rejects.toThrow("read failed");

    expect(mockDb.execAsync).not.toHaveBeenCalledWith("ROLLBACK");
    expect(Bugsnag.notify).toHaveBeenCalled();
  });

  it("rethrows the original error when ROLLBACK also fails", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ value: "1.1" });
    mockDb.getAllAsync.mockResolvedValue([{ exercise_id: 5 }]);
    mockDb.runAsync.mockRejectedValueOnce(new Error("update failed"));
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
    });

    await expect(updateAppExerciseIds()).rejects.toThrow("update failed");
  });

  it("rolls back if an update fails mid-transaction", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ value: "1.1" });
    mockDb.getAllAsync.mockResolvedValue([{ exercise_id: 5 }]);
    mockDb.runAsync.mockRejectedValueOnce(new Error("update failed"));

    await expect(updateAppExerciseIds()).rejects.toThrow("update failed");

    expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK");
  });
});

describe("syncExerciseFlagsFromAppData", () => {
  const settingWrites = () =>
    mockDb.runAsync.mock.calls
      .filter(([sql]: [string]) => sql.includes("INTO settings"))
      .map(([, params]: [string, string[]]) => params);

  // Regression: the premade plans step runs first and leaves dataVersion at
  // 2.1, which used to satisfy this step's "already synced" check.
  it("still syncs a database whose plans were loaded before its flags", async () => {
    mockDb.getFirstAsync.mockImplementation(
      async (_sql: string, params?: string[]) =>
        params?.[0] === "dataVersion" ? { value: "2.1" } : null,
    );
    mockDb.getAllAsync.mockResolvedValue([
      { exercise_id: 3, is_unilateral: 1, double_weight: 0 },
    ]);

    await syncExerciseFlagsFromAppData();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      "UPDATE exercises SET is_unilateral = ?, double_weight = ? WHERE app_exercise_id = ?",
      [1, 0, 3],
    );
    // dataVersion is left alone so older bundles see no change.
    expect(settingWrites()).toEqual([["appDataSyncVersion", "7"]]);
  });

  it("does nothing once the resync has run", async () => {
    mockDb.getFirstAsync.mockImplementation(
      async (_sql: string, params?: string[]) =>
        params?.[0] === "appDataSyncVersion" ? { value: "7" } : null,
    );

    await syncExerciseFlagsFromAppData();

    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rethrows the original error when ROLLBACK also fails", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ value: "1.9" });
    mockDb.getAllAsync.mockResolvedValue([
      { exercise_id: 1, is_unilateral: 1, double_weight: 0 },
    ]);
    mockDb.runAsync.mockRejectedValueOnce(new Error("update failed"));
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
    });

    await expect(syncExerciseFlagsFromAppData()).rejects.toThrow(
      "update failed",
    );
    expect(Bugsnag.notify).toHaveBeenCalled();
  });

  it("rolls back and rethrows if an update fails", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ value: "1.9" });
    mockDb.getAllAsync.mockResolvedValue([
      { exercise_id: 1, is_unilateral: 1, double_weight: 0 },
    ]);
    mockDb.runAsync.mockRejectedValueOnce(new Error("update failed"));

    await expect(syncExerciseFlagsFromAppData()).rejects.toThrow(
      "update failed",
    );
    expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK");
  });
});

// ---------------------------------------------------------------------------
// copyDataFromAppDataToUserData
// ---------------------------------------------------------------------------

describe("copyDataFromAppDataToUserData", () => {
  it("does not call ROLLBACK if the initial read fails before any transaction starts", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null); // dataVersion check passes through
    mockDb.getAllAsync.mockRejectedValue(new Error("appData read failed"));

    await expect(copyDataFromAppDataToUserData()).rejects.toThrow(
      "appData read failed",
    );
    expect(mockDb.execAsync).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("propagates the error instead of silently continuing to the next table", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.getAllAsync
      .mockResolvedValueOnce([{ muscle: "chest" }]) // muscles table read succeeds
      .mockRejectedValueOnce(new Error("equipment_list read failed")); // next table fails

    await expect(copyDataFromAppDataToUserData()).rejects.toThrow(
      "equipment_list read failed",
    );
  });
  it("rethrows the copy error when ROLLBACK also fails", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.getAllAsync.mockResolvedValueOnce([{ muscle: "chest" }]);
    mockDb.runAsync.mockRejectedValueOnce(new Error("insert failed"));
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("rollback failed");
    });

    await expect(copyDataFromAppDataToUserData()).rejects.toThrow(
      "insert failed",
    );
    expect(mockDb.execAsync).toHaveBeenCalledWith("ROLLBACK");
  });

  it("reports exercise copy progress in batches up to the total", async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const exercises = Array.from({ length: 120 }, (_, i) => ({
      exercise_id: i + 1,
      name: `Ex ${i + 1}`,
    }));
    mockDb.getAllAsync
      .mockResolvedValueOnce([]) // muscles
      .mockResolvedValueOnce([]) // equipment_list
      .mockResolvedValueOnce([]) // body_parts
      .mockResolvedValueOnce(exercises);
    const onProgress = jest.fn();

    await copyDataFromAppDataToUserData(onProgress);

    expect(onProgress.mock.calls).toEqual([
      [0, 120],
      [50, 120],
      [100, 120],
      [120, 120],
    ]);
  });

  it("reports no progress when the data was already copied", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ value: "2.1" });
    const onProgress = jest.fn();

    await copyDataFromAppDataToUserData(onProgress);

    expect(onProgress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updatePlanWorkoutExercises
// ---------------------------------------------------------------------------

describe("updatePlanWorkoutExercises", () => {
  it("updates the same row when exercises are reordered, instead of reassigning by position", async () => {
    const txnGetAllAsync = jest.fn().mockResolvedValue([
      { id: 100, exercise_id: 1, exercise_order: 0 },
      { id: 101, exercise_id: 2, exercise_order: 1 },
    ]);
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ getAllAsync: txnGetAllAsync, runAsync: txnRunAsync });
      },
    );

    // The two exercises swapped positions (id 101 is now first, id 100 second)
    // but neither was added or removed.
    await updatePlanWorkoutExercises(1, [
      { id: 101, exercise_id: 2, sets: [] } as any,
      { id: 100, exercise_id: 1, sets: [] } as any,
    ]);

    // Row 101 must be updated to exercise_order 0 (not have row 100's data
    // written into the "order 0" slot it used to occupy).
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_workout_exercises"),
      expect.arrayContaining([2, expect.any(String), 0, null, null, 101]),
    );
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_workout_exercises"),
      expect.arrayContaining([1, expect.any(String), 1, null, null, 100]),
    );
    // No row should be soft-deleted — both ids were present in the incoming list.
    expect(txnRunAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("is_deleted = TRUE"),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// updateStandaloneWorkout
// ---------------------------------------------------------------------------

describe("updateStandaloneWorkout", () => {
  it("updates the same row when exercises are reordered, instead of reassigning by position", async () => {
    const txnGetAllAsync = jest.fn().mockResolvedValue([
      { id: 100, exercise_id: 1, exercise_order: 0 },
      { id: 101, exercise_id: 2, exercise_order: 1 },
    ]);
    const txnRunAsync = jest.fn().mockResolvedValue({});
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (txn: any) => Promise<void>) => {
        await cb({ getAllAsync: txnGetAllAsync, runAsync: txnRunAsync });
      },
    );

    // The two exercises swapped positions (id 101 is now first, id 100 second)
    // but neither was added or removed.
    await updateStandaloneWorkout(1, "name", [
      { id: 101, exercise_id: 2, sets: [] } as any,
      { id: 100, exercise_id: 1, sets: [] } as any,
    ]);

    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_workouts SET name = ?"),
      ["name", 1],
    );
    // Row 101 must be updated to exercise_order 0 (not have row 100's data
    // written into the "order 0" slot it used to occupy).
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_workout_exercises"),
      expect.arrayContaining([2, expect.any(String), 0, null, null, 101]),
    );
    expect(txnRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_workout_exercises"),
      expect.arrayContaining([1, expect.any(String), 1, null, null, 100]),
    );
    // No row should be soft-deleted — both ids were present in the incoming list.
    expect(txnRunAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("is_deleted = TRUE"),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// fetchBodyMeasurementSessions — LIMIT parameterization
// ---------------------------------------------------------------------------

describe("fetchBodyMeasurementSessions — LIMIT parameterization", () => {
  it("binds the limit as a query parameter instead of interpolating it", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await fetchBodyMeasurementSessions({} as any, 5);

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.not.stringContaining("LIMIT 5"),
      [5],
    );
  });
});

// ---------------------------------------------------------------------------
// fetchLatestBodyMetricValues
// ---------------------------------------------------------------------------

describe("fetchLatestBodyMetricValues", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 1,
    key: "weight",
    label: "Body Weight",
    value_kind: "mass",
    is_builtin: 1,
    is_active: 1,
    is_deleted: 0,
    sort_order: 0,
    value: 82.5,
    recorded_at: "2026-09-21 08:00:00",
    ...over,
  });

  it("converts each metric's stored value into the caller's display unit", async () => {
    mockDb.getAllAsync.mockResolvedValue([row()]);

    const result = await fetchLatestBodyMetricValues({
      weightUnit: "lbs",
      sizeUnit: "cm",
    });

    expect(result).toHaveLength(1);
    expect(result[0].metric.key).toBe("weight");
    expect(result[0].canonicalValue).toBe(82.5);
    expect(result[0].displayUnit).toBe("lbs");
    expect(result[0].displayValue).toBeCloseTo(181.9, 1);
    expect(result[0].recorded_at).toBe("2026-09-21 08:00:00");
  });

  // The whole point of this query: an infrequently logged metric must not fall
  // out of a "last N sessions" window, so it must not be limited at all.
  it("does not limit how far back it looks", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await fetchLatestBodyMetricValues({ weightUnit: "kg", sizeUnit: "cm" });

    const [sql] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT/i);
  });

  // Backdated entries get a fixed noon timestamp, so the same metric can hold
  // two readings with identical recorded_at. The later entry id must win, or a
  // correction may never surface.
  it("breaks recorded_at ties on entry id rather than arbitrarily", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await fetchLatestBodyMetricValues({ weightUnit: "kg", sizeUnit: "cm" });

    const [sql] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/e2\.recorded_at > bme\.recorded_at/);
    expect(sql).toMatch(
      /e2\.recorded_at = bme\.recorded_at AND e2\.id > bme\.id/,
    );
  });

  // Without GROUP BY there is no reliance on SQLite's bare-column extension:
  // every selected column comes from the row actually being returned.
  it("does not depend on grouping to pick the row", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await fetchLatestBodyMetricValues({ weightUnit: "kg", sizeUnit: "cm" });

    const [sql] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).not.toMatch(/GROUP BY/i);
    expect(sql).not.toMatch(/MAX\(/i);
  });

  it("keeps deactivated metrics so callers can detect prior history", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await fetchLatestBodyMetricValues({ weightUnit: "kg", sizeUnit: "cm" });

    const [sql] = mockDb.getAllAsync.mock.calls[0];
    expect(sql).toMatch(/bmd\.is_deleted = 0/);
    expect(sql).not.toMatch(/bmd\.is_active = 1/);
  });
});

// ---------------------------------------------------------------------------
// fetchCompletedWorkoutById
// ---------------------------------------------------------------------------

describe("fetchCompletedWorkoutById", () => {
  it("includes the completed_exercises row id as completed_exercise_id", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 1,
        plan_id: null,
        workout_id: 10,
        workout_name: "Push Day",
        is_deload: 0,
        date_completed: "2026-06-01T00:00:00.000Z",
        duration: 600,
        total_sets_completed: 1,
        completed_exercise_id: 555,
        exercise_id: 100,
        exercise_name: "Bench Press",
        exercise_image: null,
        exercise_order: 0,
        exercise_tracking_type: "weight",
        is_unilateral: 0,
        double_weight: 0,
        set_id: 1001,
        set_number: 1,
        weight: 100,
        reps: 8,
        time: null,
        distance: null,
        is_warmup: 0,
        set_duration: null,
      },
    ]);

    const result = await fetchCompletedWorkoutById(1, "kg", "m");

    expect(result.exercises[0].completed_exercise_id).toBe(555);
  });

  it("preserves two completed_exercises rows that share the same exercise_id", async () => {
    const baseRow = {
      id: 1,
      plan_id: null,
      workout_id: 10,
      workout_name: "Push Day",
      is_deload: 0,
      date_completed: "2026-06-01T00:00:00.000Z",
      duration: 600,
      total_sets_completed: 2,
      exercise_id: 100,
      exercise_name: "Bench Press",
      exercise_image: null,
      exercise_tracking_type: "weight",
      is_unilateral: 0,
      double_weight: 0,
      is_warmup: 0,
      set_duration: null,
    };
    mockDb.getAllAsync.mockResolvedValue([
      {
        ...baseRow,
        completed_exercise_id: 10,
        exercise_order: 0,
        set_id: 1001,
        set_number: 1,
        weight: 100,
        reps: 8,
        time: null,
        distance: null,
      },
      {
        ...baseRow,
        completed_exercise_id: 11,
        exercise_order: null,
        set_id: 2001,
        set_number: 1,
        weight: 80,
        reps: 10,
        time: null,
        distance: null,
      },
    ]);

    const result = await fetchCompletedWorkoutById(1, "kg", "m");

    expect(result.exercises).toHaveLength(2);
    expect(result.exercises[0].completed_exercise_id).toBe(10);
    expect(result.exercises[1].completed_exercise_id).toBe(11);
    expect(result.exercises[0].sets).toHaveLength(1);
    expect(result.exercises[1].sets).toHaveLength(1);
  });

  it("keeps a missing weight and reps as null instead of 0", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 1,
        plan_id: null,
        workout_id: 10,
        workout_name: "Plank",
        is_deload: 0,
        date_completed: "2026-06-01T00:00:00.000Z",
        duration: 600,
        total_sets_completed: 1,
        completed_exercise_id: 555,
        exercise_id: 100,
        exercise_name: "Plank",
        exercise_image: null,
        exercise_order: 0,
        exercise_tracking_type: "time",
        is_unilateral: 0,
        double_weight: 0,
        set_id: 1001,
        set_number: 1,
        weight: null,
        reps: null,
        time: 60,
        distance: null,
        is_warmup: 0,
        set_duration: null,
      },
    ]);

    const [set] = (await fetchCompletedWorkoutById(1, "lbs", "ft")).exercises[0]
      .sets;

    expect(set.weight).toBeNull();
    expect(set.reps).toBeNull();
    expect(set.distance).toBeNull();
    expect(set.time).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// createDatabaseSnapshot / checkDatabaseIntegrity
// ---------------------------------------------------------------------------

describe("createDatabaseSnapshot", () => {
  const makeTarget = (exists: boolean) => ({
    exists,
    uri: "file:///data/cache/backup%20snapshot/user's.db",
    delete: jest.fn(),
  });

  it("vacuums userData.db into the target's plain path, escaping quotes", async () => {
    const target = makeTarget(false);

    const result = await createDatabaseSnapshot(target as any);

    expect(result).toBe(target);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith("userData.db", {
      useNewConnection: true,
    });
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "VACUUM INTO '/data/cache/backup snapshot/user''s.db'",
    );
    expect(target.delete).not.toHaveBeenCalled();
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });

  it("deletes an existing target first, since VACUUM INTO refuses to overwrite", async () => {
    const target = makeTarget(true);

    await createDatabaseSnapshot(target as any);

    expect(target.delete).toHaveBeenCalled();
  });

  it("closes the connection when VACUUM INTO fails", async () => {
    mockDb.execAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith("VACUUM")) throw new Error("disk I/O error");
    });

    await expect(
      createDatabaseSnapshot(makeTarget(false) as any),
    ).rejects.toThrow("disk I/O error");
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });
});

describe("checkDatabaseIntegrity", () => {
  const file = {
    name: "userData.db",
    parentDirectory: { uri: "file:///data/cache/restore-staging/" },
  };

  it("opens the file in its own directory and returns true for ok", async () => {
    mockDb.getAllAsync.mockResolvedValue([{ integrity_check: "ok" }]);

    expect(await checkDatabaseIntegrity(file as any)).toBe(true);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith(
      "userData.db",
      { useNewConnection: true },
      "/data/cache/restore-staging/",
    );
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });

  it("returns false when SQLite reports problems", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { integrity_check: "*** in database main ***" },
      { integrity_check: "Page 12: btreeInitPage() returns error code 11" },
    ]);

    expect(await checkDatabaseIntegrity(file as any)).toBe(false);
    expect(mockDb.closeAsync).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// openDatabase
// ---------------------------------------------------------------------------

describe("openDatabase", () => {
  it("sets the busy timeout on the connection", async () => {
    await openDatabase("userData.db");

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "PRAGMA busy_timeout = 3000;",
    );
  });

  // expo-sqlite runs exclusive transactions on a second connection, which
  // does not inherit the pragma above.
  it("sets the busy timeout on the transaction connection before the task runs", async () => {
    const order: string[] = [];
    const txn = {
      execAsync: jest.fn(async (sql: string) => {
        order.push(sql);
      }),
    };
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (t: typeof txn) => Promise<void>) => {
        await cb(txn);
      },
    );
    const db = await openDatabase("userData.db");

    await db.withExclusiveTransactionAsync(async (t) => {
      order.push("task");
      expect(t).toMatchObject({ execAsync: txn.execAsync });
    });

    expect(order).toEqual(["PRAGMA busy_timeout = 3000;", "task"]);
  });

  it("still rejects when the task throws", async () => {
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (cb: (t: any) => Promise<void>) => {
        await cb({ execAsync: jest.fn() });
      },
    );
    const db = await openDatabase("userData.db");

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error("task failed");
      }),
    ).rejects.toThrow("task failed");
  });
});
