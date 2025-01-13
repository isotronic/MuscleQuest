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
jest.mock("@bugsnag/expo");

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (openDatabase as jest.Mock).mockResolvedValue({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
    withExclusiveTransactionAsync: jest.fn((fn) =>
      fn({ runAsync: mockRunAsync }),
    ),
  });
});

it("should insert plans and update data version if dataVersion is null", async () => {
  mockGetFirstAsync.mockResolvedValue(null); // No dataVersion exists
  mockRunAsync.mockResolvedValue({}); // Mock database writes

  await loadPremadePlans();

  expect(mockRunAsync).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "1.8"],
  );
  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
});

it("should handle database errors when inserting plans", async () => {
  mockGetFirstAsync.mockResolvedValue(null); // No dataVersion exists
  const dbError = new Error("Database insertion failed");
  mockRunAsync.mockRejectedValue(dbError); // Simulate database error

  await expect(loadPremadePlans()).rejects.toThrow("Database insertion failed");

  // Verify attempt was made to insert plans
  expect(mockRunAsync).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
});

it("should skip inserting plans if dataVersion is 1.8 or higher", async () => {
  mockGetFirstAsync.mockResolvedValue({ value: "1.8" }); // Already up-to-date

  await loadPremadePlans();

  expect(mockRunAsync).not.toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO user_plans"),
    expect.any(Array),
  );
  expect(mockRunAsync).not.toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    ["dataVersion", "1.8"],
  );
});

it("should handle database errors and notify Bugsnag", async () => {
  mockGetFirstAsync.mockRejectedValue(new Error("Database error"));

  await expect(loadPremadePlans()).rejects.toThrow("Database error");

  expect(Bugsnag.notify).toHaveBeenCalledWith(expect.any(Error));
});
