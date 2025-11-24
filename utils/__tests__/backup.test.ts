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

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  documentDirectory: "mockDocumentDirectory/",
  getInfoAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
}));

// Mock expo-updates
jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));

// Mock react-native-firebase/auth
let mockUser: { uid: string } | null = { uid: "mockUserId" };
const mockAuthInstance = {
  get currentUser() {
    return mockUser;
  },
  set currentUser(value: { uid: string } | null) {
    mockUser = value;
  },
};

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: jest.fn(() => mockAuthInstance),
}));

// Create a mock storage reference object
const mockStorageRef = {
  putFile: jest.fn().mockReturnValue({
    on: jest.fn(),
  }),
  getMetadata: jest.fn(),
  getDownloadURL: jest.fn(),
};

// Mock react-native-firebase/storage
jest.mock("@react-native-firebase/storage", () => {
  return () => ({
    ref: jest.fn(() => mockStorageRef),
  });
});

// Mock asyncStorage utility if you're using setAsyncStorageItem
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

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure user is authenticated by default
    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });

  it("should upload all files successfully when user is authenticated and files exist", async () => {
    const { getInfoAsync } = require("expo-file-system");
    // Mock getInfoAsync to pretend files exist
    getInfoAsync.mockImplementation(() => Promise.resolve({ exists: true }));

    // Mock the putFile -> on flow to simulate upload progress & success
    mockStorageRef.putFile.mockImplementation(() => {
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
            // Simulate partial progress
            onProgress({ bytesTransferred: 50, totalBytes: 100 });
            // Then simulate successful upload
            onSuccess();
          }
        },
      };

      return mockPutFileReturn;
    });

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    // Expect loading states
    expect(setIsBackupLoadingMock).toHaveBeenNthCalledWith(1, true); // set to true first
    expect(setIsBackupLoadingMock).toHaveBeenLastCalledWith(false); // set to false last

    // Because there are 3 files, check final progress was set to 1
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(1);

    // Check that files were uploaded (3 total: .db, .db-wal, .db-shm)
    expect(mockStorageRef.putFile).toHaveBeenCalledTimes(3);
  });

  it("should throw an error if user is not authenticated", async () => {
    console.log("Before:", mockAuthInstance.currentUser);
    // Simulate no user
    mockAuthInstance.currentUser = null;
    console.log("After:", mockAuthInstance.currentUser);

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("User not authenticated");

    // Loading states
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(false);
  });

  it("should throw an error if the database file does not exist", async () => {
    const { getInfoAsync } = require("expo-file-system");
    // First call simulates DB file does not exist
    getInfoAsync.mockResolvedValueOnce({ exists: false });

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Database file does not exist");
  });

  it("should handle upload failure and throw an error", async () => {
    const { getInfoAsync } = require("expo-file-system");
    // Pretend all files exist
    getInfoAsync.mockResolvedValue({ exists: true });

    // Simulate an error during putFile
    mockStorageRef.putFile.mockImplementation(() => {
      return {
        on: (
          event: string,
          onProgress: any,
          onError: (arg0: Error) => void,
        ) => {
          if (event === "state_changed") {
            // Immediately trigger error
            onError(new Error("Simulated upload failure"));
          }
        },
      };
    });

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Simulated upload failure");

    // Ensure loading states were toggled
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(false);

    // Because the upload failed, we should still have called putFile once
    // (it fails on the first file),
    // but subsequent files shouldn't have started.
    expect(mockStorageRef.putFile).toHaveBeenCalledTimes(1);
  });
});

/**
 * =============================
 * 3. TESTS FOR fetchLastBackupDate
 * =============================
 */
describe("fetchLastBackupDate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure user is authenticated by default
    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });

  it("should return the last backup date if metadata is available", async () => {
    mockStorageRef.getMetadata.mockResolvedValueOnce({
      updated: "2023-10-01T10:00:00.000Z",
    });

    const date = await fetchLastBackupDate();
    expect(date).toEqual(new Date("2023-10-01T10:00:00.000Z"));
  });

  it("should return null if metadata has no updated timestamp", async () => {
    mockStorageRef.getMetadata.mockResolvedValueOnce({}); // no 'updated' field

    const date = await fetchLastBackupDate();
    expect(date).toBeNull();
  });

  it("should return null if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    const date = await fetchLastBackupDate();
    expect(date).toBeNull();

    // Reset auth mock for other tests
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
  const queryClient = new QueryClient(); // or a mock

  // We'll need these for the final calls
  const { reloadAsync } = require("expo-updates");
  const { setAsyncStorageItem } = require("../asyncStorage");

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure user is authenticated by default
    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });

  it("should restore all files successfully when user is authenticated", async () => {
    // Mock getDownloadURL to return some dummy URL
    mockStorageRef.getDownloadURL.mockResolvedValue(
      "https://example.com/dbfile",
    );

    // Mock createDownloadResumable to simulate a successful download
    const { createDownloadResumable } = require("expo-file-system");
    createDownloadResumable.mockImplementation(
      (
        url: any,
        path: any,
        opts: any,
        progressCb: (arg0: {
          totalBytesWritten: number;
          totalBytesExpectedToWrite: number;
        }) => void,
      ) => {
        return {
          downloadAsync: jest.fn().mockImplementation(() => {
            // Simulate partial progress
            progressCb({
              totalBytesWritten: 50,
              totalBytesExpectedToWrite: 100,
            });
            return Promise.resolve(); // success
          }),
        };
      },
    );

    await restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

    // Loading states
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(false);

    // Check final progress
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(1);

    // 3 files (db, wal, shm)
    expect(createDownloadResumable).toHaveBeenCalledTimes(3);

    // Check reload and setAsyncStorageItem calls
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

    // Loading states
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(false);

    // Reset for other tests
    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });

  // Add additional test cases if needed...
});
