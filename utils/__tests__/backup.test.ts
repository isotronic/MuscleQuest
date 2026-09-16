import {
  uploadDatabaseBackup,
  fetchLastBackupDate,
  restoreDatabaseBackup,
} from "../backup";
import { Directory, File } from "expo-file-system";
import { QueryClient } from "@tanstack/react-query";

/**
 * ================
 * 1. MOCK MODULES
 * ================
 */

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
  deleteObject: jest.fn(() => Promise.resolve()),
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
    // Default: all files exist
    (File as unknown as jest.Mock).mockImplementation(() => ({
      exists: true,
      uri: "/mock/document/directory/SQLite/userData.db",
    }));
  });

  it("should upload all files successfully when user is authenticated and files exist", async () => {
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
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(100);
    expect(mockStorage.putFile).toHaveBeenCalledTimes(3);
  });

  it("removes the previous backup's WAL/SHM before uploading the .db", async () => {
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => {
      const uri = String(args[args.length - 1]);
      return {
        exists: !uri.endsWith("-wal") && !uri.endsWith("-shm"),
        uri: uri.includes("userData") ? uri : "/mock/SQLite/userData.db",
      };
    });
    mockStorage.putFile.mockImplementation(() => ({
      on: (_event: string, _onProgress: any, _onError: any, onSuccess: any) =>
        onSuccess(),
    }));
    mockStorage.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: "storage/object-not-found" });

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    expect(mockStorage.putFile).toHaveBeenCalledTimes(1);
    expect(mockStorage.deleteObject).toHaveBeenCalledTimes(2);
    expect(mockStorage.deleteObject.mock.invocationCallOrder[1]).toBeLessThan(
      mockStorage.putFile.mock.invocationCallOrder[0],
    );
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
    (File as unknown as jest.Mock).mockImplementationOnce(() => ({
      exists: false,
      uri: "/mock/document/directory/SQLite/userData.db",
    }));

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Database file does not exist");
  });

  it("should handle upload failure and throw an error", async () => {
    mockStorage.putFile.mockImplementation(() => ({
      on: (event: string, onProgress: any, onError: (arg0: Error) => void) => {
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

  // Every File/Directory the restore creates, keyed by path, so tests can see
  // which local files were deleted and which staged files were moved in.
  let files: Record<string, any>;
  let stagingDir: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    mockStorage = require("@react-native-firebase/storage");
    (File as any).downloadFileAsync = jest.fn().mockResolvedValue(undefined);

    files = {};
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => {
      const name = String(args[args.length - 1]);
      const staged = args[0]?.isStaging === true;
      const key = `${staged ? "staged" : "local"}:${name}`;
      files[key] = {
        name,
        exists: !staged,
        uri: key,
        delete: jest.fn(),
        move: jest.fn(),
      };
      return files[key];
    });
    stagingDir = {
      isStaging: true,
      exists: false,
      create: jest.fn(() => {
        stagingDir.exists = true;
      }),
      delete: jest.fn(),
    };
    (Directory as unknown as jest.Mock).mockImplementation(() => stagingDir);
  });

  it("should restore all files successfully when user is authenticated", async () => {
    mockStorage.getDownloadURL.mockResolvedValue("https://example.com/dbfile");

    await restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(false);
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(100);
    expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(3);
    expect(setAsyncStorageItem).toHaveBeenCalledWith(
      "databaseRestored",
      "true",
    );
    expect(reloadAsync).toHaveBeenCalled();
    expect(files["local:userData.db"].delete).toHaveBeenCalled();
    expect(files["staged:userData.db"].move).toHaveBeenCalledWith(
      files["local:userData.db"],
    );
    expect(files["staged:userData.db-wal"].move).toHaveBeenCalled();
    expect(stagingDir.delete).toHaveBeenCalled();
  });

  it("deletes the device's own WAL/SHM when the backup has none", async () => {
    mockStorage.getDownloadURL
      .mockResolvedValueOnce("https://example.com/dbfile")
      .mockRejectedValueOnce({ code: "storage/object-not-found" })
      .mockRejectedValueOnce({ code: "storage/object-not-found" });

    await restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

    expect(files["local:userData.db-wal"].delete).toHaveBeenCalled();
    expect(files["local:userData.db-shm"].delete).toHaveBeenCalled();
    expect(files["staged:userData.db"].move).toHaveBeenCalled();
    expect(files["staged:userData.db-wal"].move).not.toHaveBeenCalled();
    expect(reloadAsync).toHaveBeenCalled();
  });

  it("leaves local files untouched when a download fails", async () => {
    mockStorage.getDownloadURL.mockResolvedValue("https://example.com/dbfile");
    (File as any).downloadFileAsync = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network down"));

    await expect(
      restoreDatabaseBackup(
        setRestoreProgressMock,
        setIsRestoreLoadingMock,
        queryClient,
      ),
    ).rejects.toThrow("Network down");

    expect(files["local:userData.db"].delete).not.toHaveBeenCalled();
    expect(files["local:userData.db-wal"].delete).not.toHaveBeenCalled();
    expect(stagingDir.delete).toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
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
