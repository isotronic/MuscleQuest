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

jest.mock("../database", () => ({
  createDatabaseSnapshot: jest.fn((target: any) => Promise.resolve(target)),
  checkDatabaseIntegrity: jest.fn(() => Promise.resolve(true)),
}));

const mockStorage = require("@react-native-firebase/storage");
const mockDatabase = require("../database");
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

  // Every File/Directory the restore creates, keyed by path, so tests can see
  // which local files were deleted and which staged files were moved in.
  let files: Record<string, any>;
  let stagingDir: any;

  const restore = () =>
    restoreDatabaseBackup(
      setRestoreProgressMock,
      setIsRestoreLoadingMock,
      queryClient,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthInstance = getAuth();
    mockAuthInstance.currentUser = { uid: "mockUserId" };
    (File as any).downloadFileAsync = jest.fn().mockResolvedValue(undefined);
    mockDatabase.checkDatabaseIntegrity.mockResolvedValue(true);

    files = {};
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => {
      // new File(uri) re-opens a file the restore already created.
      if (args.length === 1 && files[args[0]]) return files[args[0]];
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

  describe("with a manifest", () => {
    it("downloads the current slot and replaces the local DB, WAL and SHM", async () => {
      mockRemote(manifestFor({ currentSlot: "slotB" }));

      await restore();

      expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(1);
      expect((File as any).downloadFileAsync).toHaveBeenCalledWith(
        `https://example.com/${USER_PREFIX}slotB.db`,
        files["staged:userData.db"],
        { idempotent: true },
      );
      expect(mockDatabase.checkDatabaseIntegrity).toHaveBeenCalledWith(
        files["staged:userData.db"],
      );
      // Local WAL/SHM are moved aside before the new DB goes in.
      for (const name of [
        "userData.db",
        "userData.db-wal",
        "userData.db-shm",
      ]) {
        expect(files[`local:${name}`].move).toHaveBeenCalledWith(
          files[`staged:rollback-${name}`],
        );
        expect(
          files[`local:${name}`].move.mock.invocationCallOrder[0],
        ).toBeLessThan(
          files["staged:userData.db"].move.mock.invocationCallOrder[0],
        );
      }
      expect(files["staged:userData.db"].move).toHaveBeenCalledWith(
        files["local:userData.db"],
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
      expect(files["local:userData.db"].move).not.toHaveBeenCalled();
      expect(files["local:userData.db-wal"].move).not.toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
    });

    it("aborts when the downloaded backup fails its integrity check", async () => {
      mockRemote(manifestFor());
      mockDatabase.checkDatabaseIntegrity.mockResolvedValue(false);

      const error = await restore().catch((e) => e);

      expect(classifyBackupError(error)).toBe("integrity");
      expect(files["local:userData.db"].move).not.toHaveBeenCalled();
      expect(stagingDir.delete).toHaveBeenCalled();
      expect(reloadAsync).not.toHaveBeenCalled();
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
    });
  });

  describe("legacy backup (no manifest)", () => {
    it("restores the DB with its WAL and SHM", async () => {
      mockRemote(null);

      await restore();

      expect((File as any).downloadFileAsync).toHaveBeenCalledTimes(3);
      expect(mockDatabase.checkDatabaseIntegrity).not.toHaveBeenCalled();
      expect(files["local:userData.db"].move).toHaveBeenCalledWith(
        files["staged:rollback-userData.db"],
      );
      expect(files["staged:userData.db"].move).toHaveBeenCalledWith(
        files["local:userData.db"],
      );
      expect(files["staged:userData.db-wal"].move).toHaveBeenCalled();
      expect(setRestoreProgressMock).toHaveBeenLastCalledWith(100);
      expect(reloadAsync).toHaveBeenCalled();
    });

    it("deletes the device's own WAL/SHM when the backup has none", async () => {
      mockRemote(null);
      const withUrls = mockStorage.getDownloadURL.getMockImplementation();
      mockStorage.getDownloadURL.mockImplementation(async (r: any) => {
        if (/-(wal|shm)$/.test(r.fullPath)) throw notFound();
        return withUrls(r);
      });

      await restore();

      expect(files["local:userData.db-wal"].move).toHaveBeenCalledWith(
        files["staged:rollback-userData.db-wal"],
      );
      expect(files["local:userData.db-shm"].move).toHaveBeenCalledWith(
        files["staged:rollback-userData.db-shm"],
      );
      expect(files["staged:userData.db"].move).toHaveBeenCalled();
      expect(files["staged:userData.db-wal"].move).not.toHaveBeenCalled();
      expect(reloadAsync).toHaveBeenCalled();
    });

    it("reports not-found when there is no backup at all", async () => {
      mockRemote(null);
      mockStorage.getDownloadURL.mockRejectedValue(notFound());

      const error = await restore().catch((e) => e);

      expect(classifyBackupError(error)).toBe("not-found");
      expect(files["local:userData.db"].move).not.toHaveBeenCalled();
    });
  });

  it("puts the live files back when swapping in the backup fails", async () => {
    mockRemote(null);
    const realImpl = (File as unknown as jest.Mock).getMockImplementation()!;
    (File as unknown as jest.Mock).mockImplementation((...args: any[]) => {
      const file = realImpl(...args);
      if (file.uri === "staged:userData.db-wal") {
        file.move.mockImplementation(() => {
          throw new Error("Disk full");
        });
      }
      return file;
    });

    await expect(restore()).rejects.toThrow("Disk full");

    expect(files["local:userData.db"].delete).toHaveBeenCalled();
    expect(files["staged:rollback-userData.db"].move).toHaveBeenCalledWith(
      files["local:userData.db"],
    );
    expect(files["staged:rollback-userData.db-wal"].move).toHaveBeenCalledWith(
      files["local:userData.db-wal"],
    );
    expect(reloadAsync).not.toHaveBeenCalled();
    expect(setRestoreProgressMock).toHaveBeenLastCalledWith(0);
  });

  it("leaves local files untouched when a download fails", async () => {
    mockRemote(null);
    (File as any).downloadFileAsync = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Network down"));

    await expect(restore()).rejects.toThrow("Network down");

    expect(files["local:userData.db"].move).not.toHaveBeenCalled();
    expect(files["local:userData.db-wal"].move).not.toHaveBeenCalled();
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
