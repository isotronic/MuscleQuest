import { File } from "expo-file-system";
import Bugsnag from "@bugsnag/expo";
import {
  recoverInterruptedRestore,
  swapInRestoredFiles,
} from "../restoreRollback";

// In-memory filesystem: file path -> contents, plus a set of directories.
// Moves listed in mockFailingMoves (by source path) throw, to simulate a
// failed rename.
const mockFiles = new Map<string, string>();
const mockDirs = new Set<string>();
const mockFailingMoves = new Set<string>();

jest.mock("expo-file-system", () => {
  const join = (parts: any[]) =>
    parts
      .map((p) => (typeof p === "string" ? p : p.uri))
      .join("/")
      .replace(/\/+/g, "/");

  class MockFile {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    move(dest: MockFile) {
      if (mockFailingMoves.has(this.uri)) {
        throw new Error(`Move failed: ${this.uri}`);
      }
      if (!mockFiles.has(this.uri)) throw new Error("Source missing");
      if (mockFiles.has(dest.uri)) throw new Error("Destination exists");
      mockFiles.set(dest.uri, mockFiles.get(this.uri)!);
      mockFiles.delete(this.uri);
      this.uri = dest.uri;
    }
    delete() {
      if (!mockFiles.delete(this.uri)) throw new Error("Missing");
    }
    write(content: string) {
      mockFiles.set(this.uri, content);
    }
    textSync() {
      return mockFiles.get(this.uri)!;
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    delete() {
      mockDirs.delete(this.uri);
      for (const path of [...mockFiles.keys()]) {
        if (path.startsWith(`${this.uri}/`)) mockFiles.delete(path);
      }
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: { uri: "/doc" }, cache: { uri: "/cache" } },
  };
});

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const LIVE = "/doc/SQLite/userData.db";
const ROLLBACK_DIR = "/doc/restore-rollback";
const MARKER = `${ROLLBACK_DIR}/swap-in-progress.json`;

const stage = (name: string, contents: string) => {
  mockFiles.set(`/cache/restore-staging/${name}`, contents);
  return {
    stagedFile: new File("/cache/restore-staging", name),
    name,
  };
};

// Snapshot of the SQLite folder, for asserting the exact live state.
const liveState = () =>
  Object.fromEntries(
    [...mockFiles].filter(([path]) => path.startsWith("/doc/SQLite/")),
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockFiles.clear();
  mockDirs.clear();
  mockFailingMoves.clear();
  mockFiles.set(LIVE, "old-db");
  mockFiles.set(`${LIVE}-wal`, "old-wal");
  mockFiles.set(`${LIVE}-shm`, "old-shm");
});

describe("swapInRestoredFiles", () => {
  it("replaces the DB and removes the local WAL/SHM, then cleans up", () => {
    swapInRestoredFiles([stage("userData.db", "new-db")]);

    expect(liveState()).toEqual({ [LIVE]: "new-db" });
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
    expect(mockFiles.has(MARKER)).toBe(false);
  });

  it("puts the originals back and rethrows when moving the backup in fails", () => {
    const staged = [
      stage("userData.db", "new-db"),
      stage("userData.db-wal", "new-wal"),
    ];
    mockFailingMoves.add("/cache/restore-staging/userData.db-wal");

    expect(() => swapInRestoredFiles(staged)).toThrow(
      "Move failed: /cache/restore-staging/userData.db-wal",
    );

    expect(liveState()).toEqual({
      [LIVE]: "old-db",
      [`${LIVE}-wal`]: "old-wal",
      [`${LIVE}-shm`]: "old-shm",
    });
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
  });

  it("keeps the marker and rollback copies when putting a file back fails, and startup finishes the job", () => {
    const staged = [
      stage("userData.db", "new-db"),
      stage("userData.db-wal", "new-wal"),
    ];
    mockFailingMoves.add("/cache/restore-staging/userData.db-wal");
    mockFailingMoves.add(`${ROLLBACK_DIR}/rollback-userData.db`);

    // The original error surfaces, not the rollback failure.
    expect(() => swapInRestoredFiles(staged)).toThrow(
      "Move failed: /cache/restore-staging/userData.db-wal",
    );
    expect(Bugsnag.notify).toHaveBeenCalled();
    expect(mockFiles.has(MARKER)).toBe(true);
    expect(mockFiles.get(`${ROLLBACK_DIR}/rollback-userData.db`)).toBe(
      "old-db",
    );
    // The files that could be put back were.
    expect(mockFiles.get(`${LIVE}-wal`)).toBe("old-wal");
    expect(mockFiles.get(`${LIVE}-shm`)).toBe("old-shm");

    // A later restore attempt refuses to overwrite the pending rollback.
    expect(() =>
      swapInRestoredFiles([stage("userData.db", "newer-db")]),
    ).toThrow("An earlier restore could not be undone");
    expect(mockFiles.get(`${ROLLBACK_DIR}/rollback-userData.db`)).toBe(
      "old-db",
    );

    mockFailingMoves.clear();
    expect(recoverInterruptedRestore()).toBe(true);
    expect(liveState()).toEqual({
      [LIVE]: "old-db",
      [`${LIVE}-wal`]: "old-wal",
      [`${LIVE}-shm`]: "old-shm",
    });
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
  });

  it("clears a leftover rollback folder with no marker before swapping", () => {
    mockDirs.add(ROLLBACK_DIR);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "stale");

    swapInRestoredFiles([stage("userData.db", "new-db")]);

    expect(liveState()).toEqual({ [LIVE]: "new-db" });
    expect(mockFiles.has(`${ROLLBACK_DIR}/rollback-userData.db`)).toBe(false);
  });
});

describe("recoverInterruptedRestore", () => {
  const writeMarker = (originals: string[]) => {
    mockDirs.add(ROLLBACK_DIR);
    mockFiles.set(MARKER, JSON.stringify({ originals }));
  };

  it("does nothing when no restore was in progress", () => {
    expect(recoverInterruptedRestore()).toBe(false);
    expect(liveState()).toEqual({
      [LIVE]: "old-db",
      [`${LIVE}-wal`]: "old-wal",
      [`${LIVE}-shm`]: "old-shm",
    });
  });

  it("only removes a rollback folder that has no marker", () => {
    mockDirs.add(ROLLBACK_DIR);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "older-db");

    expect(recoverInterruptedRestore()).toBe(false);
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
    expect(mockFiles.get(LIVE)).toBe("old-db");
  });

  it("treats an unreadable marker as nothing moved", () => {
    mockDirs.add(ROLLBACK_DIR);
    mockFiles.set(MARKER, '{"origi');

    expect(recoverInterruptedRestore()).toBe(false);
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
    expect(mockFiles.get(LIVE)).toBe("old-db");
  });

  it("recovers from being killed while moving the live files aside", () => {
    // The DB was moved aside; the WAL and SHM were not reached.
    writeMarker(["userData.db", "userData.db-wal", "userData.db-shm"]);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "old-db");
    mockFiles.delete(LIVE);

    expect(recoverInterruptedRestore()).toBe(true);
    expect(liveState()).toEqual({
      [LIVE]: "old-db",
      [`${LIVE}-wal`]: "old-wal",
      [`${LIVE}-shm`]: "old-shm",
    });
  });

  it("recovers from being killed while moving the backup in", () => {
    // No WAL/SHM existed; a legacy backup's DB and WAL had been moved in.
    mockFiles.delete(`${LIVE}-wal`);
    mockFiles.delete(`${LIVE}-shm`);
    writeMarker(["userData.db"]);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "old-db");
    mockFiles.set(LIVE, "new-db");
    mockFiles.set(`${LIVE}-wal`, "new-wal");

    expect(recoverInterruptedRestore()).toBe(true);
    // The backup's WAL must not be left beside the original DB.
    expect(liveState()).toEqual({ [LIVE]: "old-db" });
    expect(mockDirs.has(ROLLBACK_DIR)).toBe(false);
  });

  it("recovers when SQLite created an empty DB over the missing original", () => {
    writeMarker(["userData.db"]);
    mockFiles.delete(`${LIVE}-wal`);
    mockFiles.delete(`${LIVE}-shm`);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "old-db");
    mockFiles.set(LIVE, "empty-db");

    expect(recoverInterruptedRestore()).toBe(true);
    expect(liveState()).toEqual({ [LIVE]: "old-db" });
  });

  it("throws and keeps everything when a file still can't be put back", () => {
    writeMarker(["userData.db", "userData.db-wal", "userData.db-shm"]);
    mockFiles.set(`${ROLLBACK_DIR}/rollback-userData.db`, "old-db");
    mockFiles.delete(LIVE);
    mockFailingMoves.add(`${ROLLBACK_DIR}/rollback-userData.db`);

    expect(() => recoverInterruptedRestore()).toThrow("Move failed");
    expect(mockFiles.has(MARKER)).toBe(true);
    expect(mockFiles.get(`${ROLLBACK_DIR}/rollback-userData.db`)).toBe(
      "old-db",
    );
  });
});
