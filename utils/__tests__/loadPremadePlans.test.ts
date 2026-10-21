import { loadPremadePlans, loadPremadePlansV3 } from "@/utils/loadPremadePlans";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database");
jest.mock(
  "@/assets/data/3-day-full-body.json",
  () => [{ app_plan_id: 1, name: "3 Day Plan", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/4-day-split.json",
  () => [{ app_plan_id: 2, name: "4 Day Split", workouts: [] }],
  { virtual: true },
);
// 5-day-bro-split has one exercise so we can test ID translation + ensureAppExercisesExist
jest.mock(
  "@/assets/data/5-day-bro-split.json",
  () => [
    {
      app_plan_id: 3,
      name: "5 Day Bro Split",
      workouts: [
        {
          id: null,
          plan_id: null,
          name: "Day 1 – Chest",
          is_deleted: false,
          exercises: [
            {
              id: null,
              workout_id: null,
              exercise_id: 11,
              exercise_name: "Barbell Bench Press",
              sets: [
                { repsMin: 8, repsMax: 10, restMinutes: 2, restSeconds: 0 },
              ],
              exercise_order: 1,
              is_deleted: false,
            },
          ],
        },
      ],
    },
  ],
  { virtual: true },
);
jest.mock(
  "@/assets/data/5-day-ppl.json",
  () => [{ app_plan_id: 7, name: "5 Day PPL", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/6-day-split.json",
  () => [{ app_plan_id: 4, name: "6 Day Split", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/body-weight.json",
  () => [{ app_plan_id: 5, name: "Bodyweight (3 Days)", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/dumbbell-only.json",
  () => [{ app_plan_id: 6, name: "Dumbbell Only (4 Days)", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/beginner-growth.json",
  () => [
    {
      app_plan_id: 8,
      name: "Beginner Growth (3 Days)",
      workouts: [
        {
          id: null,
          plan_id: null,
          name: "Day 1 – Squat & Bench",
          is_deleted: false,
          exercises: [
            {
              id: null,
              workout_id: null,
              exercise_id: 136,
              exercise_name: "Barbell Straight Leg Deadlift",
              sets: [
                { repsMin: 10, repsMax: 12, restMinutes: 2, restSeconds: 0 },
              ],
              exercise_order: 1,
              is_deleted: false,
            },
          ],
        },
      ],
    },
  ],
  { virtual: true },
);
jest.mock(
  "@/assets/data/classic-5x5.json",
  () => [{ app_plan_id: 9, name: "Classic 5x5", workouts: [] }],
  { virtual: true },
);
jest.mock(
  "@/assets/data/2-day-full-body.json",
  () => [{ app_plan_id: 10, name: "2-Day Full Body", workouts: [] }],
  { virtual: true },
);
jest.mock("@bugsnag/expo");

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

const mockCloseAsync = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockRunAsync.mockResolvedValue({ lastInsertRowId: 1 });
  mockCloseAsync.mockResolvedValue(undefined);
  (openDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
    closeAsync: mockCloseAsync,
    withExclusiveTransactionAsync: jest.fn((fn) =>
      fn({ runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync }),
    ),
  });
});

it("should insert v1.8 and v2.1 plans and update both data versions if dataVersion is null", async () => {
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("app_exercise_id = ?"))
      return Promise.resolve({ exercise_id: 42 });
    return Promise.resolve(null);
  });

  await loadPremadePlans();

  expect(mockRunAsync).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "1.8"],
  );
  expect(mockRunAsync).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "2.1"],
  );
  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
  // The integer sync version is written alongside each legacy value.
  expect(mockRunAsync).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["appDataSyncVersion", "4"],
  );
  expect(mockRunAsync).toHaveBeenLastCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["appDataSyncVersion", "6"],
  );
});

it("should skip both plan batches when only the integer sync version is set", async () => {
  mockGetFirstAsync.mockImplementation((_sql: string, params?: string[]) =>
    Promise.resolve(
      params?.[0] === "appDataSyncVersion" ? { value: "6" } : null,
    ),
  );

  await loadPremadePlans();

  expect(mockRunAsync).not.toHaveBeenCalled();
});

it("should handle database errors when inserting plans", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGetFirstAsync.mockResolvedValue(null);
  const dbError = new Error("Database insertion failed");
  mockRunAsync.mockRejectedValue(dbError);

  await expect(loadPremadePlans()).rejects.toThrow("Database insertion failed");

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
});

it("should skip v1.8 plans but load v2.1 plans when dataVersion is 1.8", async () => {
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("key = ?")) return Promise.resolve({ value: "1.8" });
    if (sql.includes("app_exercise_id = ?"))
      return Promise.resolve({ exercise_id: 42 });
    return Promise.resolve(null);
  });

  await loadPremadePlans();

  expect(mockRunAsync).not.toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "1.8"],
  );
  expect(mockRunAsync).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "2.1"],
  );
  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
});

it("should skip all plan insertions if dataVersion is 2.1 or higher", async () => {
  mockGetFirstAsync.mockResolvedValue({ value: "2.1" });

  await loadPremadePlans();

  expect(mockRunAsync).not.toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
  expect(mockRunAsync).not.toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    expect.any(Array),
  );
});

it("should handle database errors and notify Bugsnag", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockGetFirstAsync.mockRejectedValue(new Error("Database error"));

  await expect(loadPremadePlans()).rejects.toThrow("Database error");

  expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
});

it("should translate app exercise IDs to local userData IDs when inserting exercises", async () => {
  const localExerciseId = 42;
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("key = ?")) return Promise.resolve({ value: "1.8" });
    if (sql.includes("app_exercise_id = ?"))
      return Promise.resolve({ exercise_id: localExerciseId });
    return Promise.resolve(null);
  });

  await loadPremadePlans();

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_workout_exercises"),
    expect.arrayContaining([localExerciseId]),
  );
});

it("should throw and roll back when an exercise's app_exercise_id is not found in userData", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("key = ?")) return Promise.resolve({ value: "1.8" });
    return Promise.resolve(null); // exercise not found anywhere
  });

  await expect(loadPremadePlans()).rejects.toThrow(
    /Exercise with app_exercise_id=11 not found in userData\.db/,
  );

  expect(mockRunAsync).not.toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_workout_exercises"),
    expect.any(Array),
  );
});

it("should copy missing exercises from the library into userData.db", async () => {
  const appExerciseRow = {
    exercise_id: 11,
    name: "Barbell Bench Press",
    image: null,
    local_animated_uri: null,
    animated_url: null,
    equipment: "barbell",
    body_part: "chest",
    target_muscle: "pectoralis major sternal head",
    secondary_muscles: null,
    description: null,
    is_deleted: 0,
    tracking_type: null,
    is_unilateral: null,
    double_weight: null,
  };
  let exerciseCopied = false;
  mockRunAsync.mockImplementation((sql: string) => {
    if (sql.includes("INSERT INTO exercises")) exerciseCopied = true;
    return Promise.resolve({ lastInsertRowId: 1 });
  });
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("key = ?")) return Promise.resolve({ value: "1.8" });
    if (sql.includes("app_exercise_id = ?"))
      return Promise.resolve(exerciseCopied ? { exercise_id: 11 } : null);
    if (sql.includes("WHERE exercise_id = ?"))
      return Promise.resolve(appExerciseRow); // found in the library
    return Promise.resolve(null);
  });

  await loadPremadePlans();

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO exercises"),
    expect.arrayContaining([11, "Barbell Bench Press"]),
  );
});

it("reports one progress step per plan file on a fresh install", async () => {
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("app_exercise_id = ?"))
      return Promise.resolve({ exercise_id: 42 });
    return Promise.resolve(null);
  });
  const onProgress = jest.fn();

  await loadPremadePlans(onProgress);

  expect(onProgress.mock.calls).toEqual([
    [0, 7],
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [6, 7],
    [7, 7],
  ]);
});

it("reports no progress when the plans are already loaded", async () => {
  mockGetFirstAsync.mockImplementation((sql: string) => {
    if (sql.includes("key = ?")) return Promise.resolve({ value: "2.1" });
    return Promise.resolve(null);
  });
  const onProgress = jest.fn();

  await loadPremadePlans(onProgress);

  expect(onProgress).not.toHaveBeenCalled();
});

describe("loadPremadePlansV3", () => {
  const atSyncVersion = (version: string) =>
    mockGetFirstAsync.mockImplementation((sql: string, params?: unknown[]) => {
      if (params?.[0] === "appDataSyncVersion")
        return Promise.resolve({ value: version });
      if (sql.includes("app_exercise_id = ?"))
        return Promise.resolve({ exercise_id: 42 });
      return Promise.resolve(null);
    });

  it("loads the three plans after the library refresh and bumps to 9", async () => {
    atSyncVersion("8");
    const onProgress = jest.fn();

    await loadPremadePlansV3(onProgress);

    const planNames = mockRunAsync.mock.calls
      .filter(([sql]) => String(sql).includes("INSERT INTO user_plans"))
      .map(([, params]) => params[1]);
    expect(planNames).toEqual([
      "Beginner Growth (3 Days)",
      "Classic 5x5",
      "2-Day Full Body",
    ]);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO user_workout_exercises"),
      expect.arrayContaining([42]),
    );
    // No legacy dataVersion for this step.
    expect(mockRunAsync).toHaveBeenLastCalledWith(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      ["appDataSyncVersion", "9"],
    );
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("does nothing once the plans are loaded", async () => {
    atSyncVersion("9");
    const onProgress = jest.fn();

    await loadPremadePlansV3(onProgress);

    expect(mockRunAsync).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });
});
