import {
  clearDatabaseAndReinitialize,
  clearActivePlanStatus,
} from "../clearUserData";
import { openDatabase } from "@/utils/database";
import * as Updates from "expo-updates";
import Bugsnag from "@bugsnag/expo";

// jest.mock factories are hoisted; only `mock*` (lowercase) variables are
// accessible inside factories, so we embed the mock state in the factory and
// expose it via the mocked module itself.
jest.mock("expo-file-system", () => {
  const mockDeleteFn = jest.fn();
  const mockFileInst = { exists: true, delete: mockDeleteFn };
  const mockFileCtor = jest.fn(() => mockFileInst);
  return {
    File: mockFileCtor,
    Paths: { document: "/mock/documents" },
    // Exposed for tests
    __mockFileInst: mockFileInst,
    __mockFileCtor: mockFileCtor,
    __mockDeleteFn: mockDeleteFn,
  };
});
jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));
jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

// Helpers to access internals of the expo-file-system mock
const getFileMocks = () =>
  jest.requireMock("expo-file-system") as {
    __mockFileInst: { exists: boolean; delete: jest.Mock };
    __mockFileCtor: jest.Mock;
    __mockDeleteFn: jest.Mock;
  };

// ---------------------------------------------------------------------------
// clearDatabaseAndReinitialize
// ---------------------------------------------------------------------------

describe("clearDatabaseAndReinitialize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);
    getFileMocks().__mockFileInst.exists = true;
  });

  it("deletes the database file when it exists", async () => {
    await clearDatabaseAndReinitialize();
    expect(getFileMocks().__mockDeleteFn).toHaveBeenCalled();
  });

  it("does not try to delete when the file does not exist", async () => {
    getFileMocks().__mockFileInst.exists = false;
    await clearDatabaseAndReinitialize();
    expect(getFileMocks().__mockDeleteFn).not.toHaveBeenCalled();
  });

  it("calls Updates.reloadAsync after deleting the database", async () => {
    await clearDatabaseAndReinitialize();
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });

  it("creates the File with correct path arguments", async () => {
    await clearDatabaseAndReinitialize();
    expect(getFileMocks().__mockFileCtor).toHaveBeenCalledWith(
      "/mock/documents",
      "SQLite",
      "userData.db",
    );
  });

  it("notifies Bugsnag when an error occurs", async () => {
    const error = new Error("reload failed");
    (Updates.reloadAsync as jest.Mock).mockRejectedValue(error);
    await clearDatabaseAndReinitialize();
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// clearActivePlanStatus
// ---------------------------------------------------------------------------

describe("clearActivePlanStatus", () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = { runAsync: jest.fn().mockResolvedValue(undefined) };
    (openDatabase as jest.Mock).mockResolvedValue(mockDb);
    (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it("runs the SQL to clear active plan status", async () => {
    await clearActivePlanStatus();
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE user_plans SET is_active = false"),
    );
  });

  it("calls Updates.reloadAsync after the SQL update", async () => {
    await clearActivePlanStatus();
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });

  it("notifies Bugsnag when the DB call fails", async () => {
    const error = new Error("db error");
    (openDatabase as jest.Mock).mockRejectedValue(error);
    await clearActivePlanStatus();
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
