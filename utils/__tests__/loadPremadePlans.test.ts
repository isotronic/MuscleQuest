import { loadPremadePlans } from "@/utils/loadPremadePlans";
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
jest.mock("@bugsnag/expo");

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRunAsync.mockResolvedValue({ lastInsertRowId: 1 });
  (openDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
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
});

it("should handle database errors when inserting plans", async () => {
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

it("should copy missing exercises from appData3.db into userData.db", async () => {
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
      return Promise.resolve(appExerciseRow); // found in appData3
    return Promise.resolve(null);
  });

  await loadPremadePlans();

  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO exercises"),
    expect.arrayContaining([11, "Barbell Bench Press"]),
  );
});
