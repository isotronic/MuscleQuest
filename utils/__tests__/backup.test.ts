import {
  uploadDatabaseBackup,
  fetchLastBackupDate,
  restoreDatabaseBackup,
} from "../backup";
import { QueryClient } from "@tanstack/react-query";

/**
 * ================
 * 1. MOCK MODULES
 * ================
 */

// Mock expo-file-system/legacy
jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "mockDocumentDirectory/",
  getInfoAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
}));

// Mock expo-updates
jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));

// Use the auth mock from jestSetupFile.js and get a reference to it
const { getAuth } = require("@react-native-firebase/auth");
let mockAuthInstance: any;

// mockStorageRef is returned by ref() — starts with 'mock' so it can be used in jest.mock factory
const mockStorageRef = {};

// Mock react-native-firebase/storage with modular API
jest.mock("@react-native-firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => mockStorageRef),
  getMetadata: jest.fn(),
  getDownloadURL: jest.fn(),
  putFile: jest.fn(() => ({ on: jest.fn() })),
}));

// Mock asyncStorage utility
jest.mock("../asyncStorage", () => ({
  setAsyncStorageItem: jest.fn(),
}));

/**
 * ==============================
 * 2. TESTS FOR uploadDatabaseBackup
 * ==============================
 */
describe("uploadDatabaseBackup", () => {
  const setBackupProgressMock = jest.fn();
  const setIsBackupLoadingMock = jest.fn();
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    mockStorage = require("@react-native-firebase/storage");
  });

  it("should upload all files successfully when user is authenticated and files exist", async () => {
    const { getInfoAsync } = require("expo-file-system/legacy");
    getInfoAsync.mockImplementation(() => Promise.resolve({ exists: true }));

    mockStorage.putFile.mockImplementation(() => {
      interface MockPutFileReturn {
        on: (
          event: string,
          onProgress: (progress: {
            bytesTransferred: number;
            totalBytes: number;
          }) => void,
          onError: () => void,
          onSuccess: () => void,
        ) => void;
      }

      const mockPutFileReturn: MockPutFileReturn = {
        on: (event, onProgress, onError, onSuccess) => {
          if (event === "state_changed") {
            onProgress({ bytesTransferred: 50, totalBytes: 100 });
            onSuccess();
          }
        },
      };

      return mockPutFileReturn;
    });

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    expect(setIsBackupLoadingMock).toHaveBeenNthCalledWith(1, true);
    expect(setIsBackupLoadingMock).toHaveBeenLastCalledWith(false);
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(1);
    expect(mockStorage.putFile).toHaveBeenCalledTimes(3);
  });

  it("should throw an error if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("User not authenticated");

    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(false);
  });

  it("should throw an error if the database file does not exist", async () => {
    const { getInfoAsync } = require("expo-file-system/legacy");
    getInfoAsync.mockResolvedValueOnce({ exists: false });

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Database file does not exist");
  });

  it("should handle upload failure and throw an error", async () => {
    const { getInfoAsync } = require("expo-file-system/legacy");
    getInfoAsync.mockResolvedValue({ exists: true });

    mockStorage.putFile.mockImplementation(() => ({
      on: (
        event: string,
        onProgress: any,
        onError: (arg0: Error) => void,
      ) => {
        if (event === "state_changed") {
          onError(new Error("Simulated upload failure"));
        }
      },
    }));

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Simulated upload failure");

    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(false);
    expect(mockStorage.putFile).toHaveBeenCalledTimes(1);
  });
});

/**
 * =============================
 * 3. TESTS FOR fetchLastBackupDate
 * =============================
 */
describe("fetchLastBackupDate", () => {
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    mockStorage = require("@react-native-firebase/storage");
  });

  it("should return the last backup date if metadata is available", async () => {
    mockStorage.getMetadata.mockResolvedValueOnce({
      updated: "2023-10-01T10:00:00.000Z",
    });

    const date = await fetchLastBackupDate();
    expect(date).toEqual(new Date("2023-10-01T10:00:00.000Z"));
  });

  it("should return null if metadata has no updated timestamp", async () => {
    mockStorage.getMetadata.mockResolvedValueOnce({});

    const date = await fetchLastBackupDate();
    expect(date).toBeNull();
  });

  it("should return null if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    const date = await fetchLastBackupDate();
    expect(date).toBeNull();

    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });
});

/**
 * ===============================
 * 4. TESTS FOR restoreDatabaseBackup
 * ===============================
 */
describe("restoreDatabaseBackup", () => {
  const setRestoreProgressMock = jest.fn();
  const setIsRestoreLoadingMock = jest.fn();
  const queryClient = new QueryClient();
  let mockStorage: any;

  const { reloadAsync } = require("expo-updates");
  const { setAsyncStorageItem } = require("../asyncStorage");

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    mockStorage = require("@react-native-firebase/storage");
  });

  it("should restore all files successfully when user is authenticated", async () => {
    mockStorage.getDownloadURL.mockResolvedValue("https://example.com/dbfile");

    const { createDownloadResumable } = require("expo-file-system/legacy");
    createDownloadResumable.mockImplementation(
      (
        url: any,
        path: any,
        opts: any,
        progressCb: (arg0: {
          totalBytesWritten: number;
          totalBytesExpectedToWrite: number;
        }) => void,
      ) => ({
        downloadAsync: jest.fn().mockImplementation(() => {
          progressCb({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
          return Promise.resolve();
        }),
      }),
    );

    await restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(false);
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(1);
    expect(createDownloadResumable).toHaveBeenCalledTimes(3);
    expect(setAsyncStorageItem).toHaveBeenCalledWith(
      "databaseRestored",
      "true",
    );
    expect(reloadAsync).toHaveBeenCalled();
  });

  it("should throw an error if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    await expect(
      restoreDatabaseBackup(
        setRestoreProgressMock,
        setIsRestoreLoadingMock,
        queryClient,
      ),
    ).rejects.toThrow("User not authenticated");

    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(false);

    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });
});
