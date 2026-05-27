import * as SQLite from "expo-sqlite";
import Bugsnag from "@bugsnag/expo";
import {
  fetchActivePlan,
  updateActivePlan,
  fetchSettings,
  updateSettings,
  deleteCompletedWorkout,
  fetchPlanSchedule,
  fetchActiveBodyMetricDefinitions,
  fetchAllBodyMetricDefinitions,
} from "../database";

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

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockDb)),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDb = makeDb();
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
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

    // 100 kg * 2.2046226 = 220.5 lbs (rounded to 1 decimal)
    expect(settings.bodyWeight).toBe("220.5");
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
