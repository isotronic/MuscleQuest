import {
  uploadDatabaseBackup,
  fetchLastBackupDate,
  restoreDatabaseBackup,
  classifyBackupError,
  BackupError,
  BACKUP_SCHEMA_VERSION,
} from "../backup";
import { Directory, File } from "expo-file-system";
import { QueryClient } from "@tanstack/react-query";

/**
 * ================
 * 1. MOCK MODULES
 * ================
 */

jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "9.9.9" } },
}));

// Use the auth mock from jestSetupFile.js and get a reference to it
const { getAuth } = require("@react-native-firebase/auth");
let mockAuthInstance: any;

// ref() returns the object path so tests can tell which object was touched.
jest.mock("@react-native-firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  getMetadata: jest.fn(),
  getDownloadURL: jest.fn(),
  putFile: jest.fn(() => ({ on: jest.fn() })),
  uploadString: jest.fn(() => Promise.resolve()),
  deleteObject: jest.fn(() => Promise.resolve()),
}));

jest.mock("../asyncStorage", () => ({
  setAsyncStorageItem: jest.fn(),
}));

jest.mock("../restoreRollback", () => ({
  swapInRestoredFiles: jest.fn(),
}));

jest.mock("../database", () => ({
  createDatabaseSnapshot: jest.fn((target: any) => Promise.resolve(target)),
  checkDatabaseIntegrity: jest.fn(() => Promise.resolve(true)),
}));

const mockStorage = require("@react-native-firebase/storage");
const mockDatabase = require("../database");
const { swapInRestoredFiles } = require("../restoreRollback");
const { reloadAsync } = require("expo-updates");
const { setAsyncStorageItem } = require("../asyncStorage");

const USER_PREFIX = "backups/mockUserId/";
const notFound = () => ({ code: "storage/object-not-found" });

// Makes getDownloadURL resolve to a URL naming the object, and fetch return
// the given manifest for the manifest URL. A null manifest means none exists.
const mockRemote = (manifest: object | null) => {
  mockStorage.getDownloadURL.mockImplementation(
    async ({ fullPath }: { fullPath: string }) => {
      if (fullPath.endsWith("manifest.json") && !manifest) throw notFound();
      return `https://example.com/${fullPath}`;
    },
  );
  (global as any).fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => manifest,
  }));
};

const manifestFor = (overrides: object = {}) => ({
  currentSlot: "slotA",
  createdAt: "2026-09-01T10:00:00.000Z",
  appVersion: "9.9.8",
  schemaVersion: BACKUP_SCHEMA_VERSION,
  sizeBytes: 1024,
  ...overrides,
});

const uploadSucceeds = () =>
  mockStorage.putFile.mockImplementation(() => ({
    on: (_event: string, onProgress: any, _onError: any, onSuccess: any) => {
      onProgress({ bytesTransferred: 50, totalBytes: 100 });
      onSuccess();
    },
  }));

const uploadFails = () =>
  mockStorage.putFile.mockImplementation(() => ({
    on: (_event: string, _onProgress: any, onError: any) =>
      onError(new Error("Simulated upload failure")),
  }));

const putFilePaths = () =>
  mockStorage.putFile.mock.calls.map(([r]: any[]) => r.fullPath);

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
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => ({
      exists: true,
      uri: `/mock/${String(args[args.length - 1])}`,
      name: String(args[args.length - 1]),
      size: 2048,
    }));
    (Directory as unknown as jest.Mock).mockImplementation(() => ({
      exists: false,
      uri: "/mock/cache/backup-snapshot",
      create: jest.fn(),
      delete: jest.fn(),
    }));
    mockDatabase.checkDatabaseIntegrity.mockResolvedValue(true);
  });

  it("writes the non-current slot, then points the manifest at it", async () => {
    mockRemote(manifestFor({ currentSlot: "slotA" }));
    uploadSucceeds();

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    expect(putFilePaths()).toEqual([`${USER_PREFIX}slotB.db`]);
    expect(mockStorage.putFile.mock.calls[0][1]).toBe(
      "/mock/userData-backup.db",
    );
    const [manifestRef, body] = mockStorage.uploadString.mock.calls[0];
    expect(manifestRef.fullPath).toBe(`${USER_PREFIX}manifest.json`);
    expect(JSON.parse(body)).toMatchObject({
      currentSlot: "slotB",
      appVersion: "9.9.9",
      schemaVersion: BACKUP_SCHEMA_VERSION,
      sizeBytes: 2048,
    });
    expect(
      mockStorage.uploadString.mock.invocationCallOrder[0],
    ).toBeGreaterThan(mockStorage.putFile.mock.invocationCallOrder[0]);
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(100);
    expect(setIsBackupLoadingMock).toHaveBeenLastCalledWith(false);
    // An existing manifest means the legacy files are already gone.
    expect(mockStorage.deleteObject).not.toHaveBeenCalled();
  });

  it("alternates back to slotA when slotB is current", async () => {
    mockRemote(manifestFor({ currentSlot: "slotB" }));
    uploadSucceeds();

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    expect(putFilePaths()).toEqual([`${USER_PREFIX}slotA.db`]);
  });

  it("deletes the legacy files after the first new-format backup", async () => {
    mockRemote(null);
    uploadSucceeds();
    mockStorage.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound());

    await uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock);

    expect(putFilePaths()).toEqual([`${USER_PREFIX}slotA.db`]);
    expect(
      mockStorage.deleteObject.mock.calls.map(([r]: any[]) => r.fullPath),
    ).toEqual([
      `${USER_PREFIX}userData.db`,
      `${USER_PREFIX}userData.db-wal`,
      `${USER_PREFIX}userData.db-shm`,
    ]);
    expect(
      mockStorage.deleteObject.mock.invocationCallOrder[0],
    ).toBeGreaterThan(mockStorage.uploadString.mock.invocationCallOrder[0]);
  });

  it("still succeeds when deleting the legacy files fails", async () => {
    mockRemote(null);
    uploadSucceeds();
    mockStorage.deleteObject.mockRejectedValueOnce(new Error("Denied"));

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).resolves.toBeUndefined();
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(100);
  });

  it("leaves the manifest untouched when the upload fails", async () => {
    mockRemote(manifestFor());
    uploadFails();

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Simulated upload failure");

    expect(putFilePaths()).toEqual([`${USER_PREFIX}slotB.db`]);
    expect(mockStorage.uploadString).not.toHaveBeenCalled();
    expect(mockStorage.deleteObject).not.toHaveBeenCalled();
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(0);
    expect(setIsBackupLoadingMock).toHaveBeenLastCalledWith(false);
  });

  it("uploads nothing when the snapshot fails its integrity check", async () => {
    mockRemote(manifestFor());
    mockDatabase.checkDatabaseIntegrity.mockResolvedValue(false);

    const error = await uploadDatabaseBackup(
      setBackupProgressMock,
      setIsBackupLoadingMock,
    ).catch((e) => e);

    expect(classifyBackupError(error)).toBe("integrity");
    expect(mockStorage.putFile).not.toHaveBeenCalled();
    expect(mockStorage.uploadString).not.toHaveBeenCalled();
    expect(setBackupProgressMock).toHaveBeenLastCalledWith(0);
  });

  it("should throw an error if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("User not authenticated");

    expect(setIsBackupLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsBackupLoadingMock).toHaveBeenLastCalledWith(false);
    expect(setBackupProgressMock).not.toHaveBeenCalledWith(100);
  });

  it("should throw an error if the database file does not exist", async () => {
    (File as unknown as jest.Mock).mockImplementationOnce(() => ({
      exists: false,
      uri: "/mock/document/directory/SQLite/userData.db",
    }));

    await expect(
      uploadDatabaseBackup(setBackupProgressMock, setIsBackupLoadingMock),
    ).rejects.toThrow("Database file does not exist");
    expect(mockDatabase.createDatabaseSnapshot).not.toHaveBeenCalled();
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
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
  });

  it("returns the manifest's createdAt when a manifest exists", async () => {
    mockRemote(manifestFor({ createdAt: "2026-09-10T08:00:00.000Z" }));

    const date = await fetchLastBackupDate();

    expect(date).toEqual(new Date("2026-09-10T08:00:00.000Z"));
    expect(mockStorage.getMetadata).not.toHaveBeenCalled();
  });

  it("falls back to the legacy file's metadata without a manifest", async () => {
    mockRemote(null);
    mockStorage.getMetadata.mockResolvedValueOnce({
      updated: "2023-10-01T10:00:00.000Z",
    });

    const date = await fetchLastBackupDate();
    expect(date).toEqual(new Date("2023-10-01T10:00:00.000Z"));
  });

  it("returns null when no backup exists in either format", async () => {
    mockRemote(null);
    mockStorage.getMetadata.mockRejectedValueOnce(notFound());

    expect(await fetchLastBackupDate()).toBeNull();
  });

  it("should return null if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    expect(await fetchLastBackupDate()).toBeNull();
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
  let stagingDir: any;

  const restore = () =>
    restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

  // Names of the files handed to the journaled swap, in order.
  const swappedNames = () =>
    (swapInRestoredFiles as jest.Mock).mock.calls[0][0].map(
      ({ name }: { name: string }) => name,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    (File as any).downloadFileAsync = jest.fn().mockResolvedValue(undefined);
    mockDatabase.checkDatabaseIntegrity.mockResolvedValue(true);
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => {
      const name = String(args[args.length - 1]);
      return { name, uri: `staged:${name}` };
    });
    stagingDir = {
      exists: false,
      create: jest.fn(() => {
        stagingDir.exists = true;
      }),
      delete: jest.fn(),
    };
    (Directory as unknown as jest.Mock).mockImplementation(() => stagingDir);
  });

  describe("with a manifest", () => {
    it("downloads and checks the current slot, then swaps it in", async () => {
      mockRemote(manifestFor({ currentSlot: "slotB" }));

      await restore();

      expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(1);
      expect((File as any).downloadFileAsync).toHaveBeenCalledWith(
        `https://example.com/${USER_PREFIX}slotB.db`,
        expect.objectContaining({ uri: "staged:userData.db" }),
        { idempotent: true },
      );
      expect(mockDatabase.checkDatabaseIntegrity).toHaveBeenCalledWith(
        expect.objectContaining({ uri: "staged:userData.db" }),
      );
      expect(swappedNames()).toEqual(["userData.db"]);
      expect(
        (swapInRestoredFiles as jest.Mock).mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        mockDatabase.checkDatabaseIntegrity.mock.invocationCallOrder[0],
      );
      expect(setAsyncStorageItem).toHaveBeenCalledWith(
        "databaseRestored",
        "true",
      );
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(100);
      expect(reloadAsync).toHaveBeenCalled();
      expect(stagingDir.delete).toHaveBeenCalled();
    });

    it("aborts on a newer schema without touching local files", async () => {
      mockRemote(manifestFor({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }));

      const error = await restore().catch((e) => e);

      expect(classifyBackupError(error)).toBe("newer-schema");
      expect((File as any).downloadFileAsync).not.toHaveBeenCalled();
      expect(swapInRestoredFiles).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
    });

    it("aborts when the downloaded backup fails its integrity check", async () => {
      mockRemote(manifestFor());
      mockDatabase.checkDatabaseIntegrity.mockResolvedValue(false);

      const error = await restore().catch((e) => e);

      expect(classifyBackupError(error)).toBe("integrity");
      expect(swapInRestoredFiles).not.toHaveBeenCalled();
      expect(stagingDir.delete).toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
    });
  });

  describe("legacy backup (no manifest)", () => {
    it("swaps in the DB with its WAL and SHM", async () => {
      mockRemote(null);

      await restore();

      expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(3);
      expect(mockDatabase.checkDatabaseIntegrity).not.toHaveBeenCalled();
      expect(swappedNames()).toEqual([
        "userData.db",
        "userData.db-wal",
        "userData.db-shm",
      ]);
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(100);
      expect(reloadAsync).toHaveBeenCalled();
    });

    it("swaps in only the DB when the backup has no WAL/SHM", async () => {
      mockRemote(null);
      const withUrls = mockStorage.getDownloadURL.getMockImplementation();
      mockStorage.getDownloadURL.mockImplementation(async (r: any) => {
        if (/-(wal|shm)$/.test(r.fullPath)) throw notFound();
        return withUrls(r);
      });

      await restore();

      expect(swappedNames()).toEqual(["userData.db"]);
      expect(reloadAsync).toHaveBeenCalled();
    });

    it("reports not-found when there is no backup at all", async () => {
      mockRemote(null);
      mockStorage.getDownloadURL.mockRejectedValue(notFound());

      const error = await restore().catch((e) => e);

      expect(classifyBackupError(error)).toBe("not-found");
      expect(swapInRestoredFiles).not.toHaveBeenCalled();
    });
  });

  it("rethrows a failed swap without reloading", async () => {
    mockRemote(manifestFor());
    (swapInRestoredFiles as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Disk full");
    });

    await expect(restore()).rejects.toThrow("Disk full");

    expect(setAsyncStorageItem).not.toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
    expect(stagingDir.delete).toHaveBeenCalled();
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
  });

  it("leaves local files untouched when a download fails", async () => {
    mockRemote(null);
    (File as any).downloadFileAsync = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network down"));

    await expect(restore()).rejects.toThrow("Network down");

    expect(swapInRestoredFiles).not.toHaveBeenCalled();
    expect(stagingDir.delete).toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
  });

  it("should throw an error if user is not authenticated", async () => {
    mockAuthInstance.currentUser = null;

    await expect(restore()).rejects.toThrow("User not authenticated");

    expect(setIsRestoreLoadingMock).toHaveBeenCalledWith(true);
    expect(setIsRestoreLoadingMock).toHaveBeenLastCalledWith(false);
    expect(setRestoreProgressMock).not.toHaveBeenCalledWith(100);
  });
});

/**
 * ===============================
 * 5. TESTS FOR classifyBackupError
 * ===============================
 */
describe("classifyBackupError", () => {
  it.each([
    [new BackupError("integrity", "x"), "integrity"],
    [{ code: "storage/object-not-found" }, "not-found"],
    [{ code: "storage/retry-limit-exceeded" }, "offline"],
    [new Error("The Internet connection appears to be offline."), "offline"],
    [new Error("Something else"), "unknown"],
    [undefined, "unknown"],
  ])("classifies %p as %s", (error, expected) => {
    expect(classifyBackupError(error)).toBe(expected);
  });
});
