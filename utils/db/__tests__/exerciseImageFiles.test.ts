import {
  forgetExerciseImageFiles,
  writeExerciseImageFiles,
} from "@/utils/db/exerciseImageFiles";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

const mockFiles = new Map<string, Uint8Array>();
const mockDirs = new Set<string>();
const mockFailingWrites = new Set<string>();
const mockCounts = { filesConstructed: 0 };
let mockDb: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async () => mockDb.db),
}));

jest.mock("@/utils/bugsnagDedup", () => ({
  notifyBugsnag: jest.fn(),
}));

jest.mock("expo-file-system", () => {
  const join = (parts: any[]) =>
    parts
      .map((p) => (typeof p === "string" ? p : p.uri))
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p))
      .join("/");
  class Directory {
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
    list() {
      return [...mockFiles.keys()]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => ({ uri, name: uri.split("/").pop() }));
    }
  }
  class File {
    uri: string;
    name: string;
    constructor(...parts: any[]) {
      mockCounts.filesConstructed++;
      this.uri = join(parts);
      this.name = this.uri.split("/").pop()!;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    write(bytes: Uint8Array) {
      if (mockFailingWrites.has(this.name)) throw new Error("disk full");
      mockFiles.set(this.uri, bytes);
    }
  }
  return { File, Directory, Paths: { document: { uri: "file:///doc/" } } };
});

const DIR = "file:///doc/exercise-images";
const uriFor = (id: number) => `${DIR}/${id}.webp`;
const bytesFor = (id: number) => new Uint8Array([82, 73, 70, 70, id % 256]);

const insertLibraryExercises = (count: number) => {
  const insert = mockDb.sqlite.prepare(
    `INSERT INTO exercises (exercise_id, app_exercise_id, name, image) VALUES (?, ?, ?, ?)`,
  );
  for (let id = 1; id <= count; id++) {
    insert.run(id, 1000 + id, `Exercise ${id}`, bytesFor(id));
  }
};

const imageUris = () =>
  Object.fromEntries(
    (
      mockDb.sqlite
        .prepare(`SELECT exercise_id, image_uri FROM exercises`)
        .all() as { exercise_id: number; image_uri: string | null }[]
    ).map((row) => [row.exercise_id, row.image_uri]),
  );

beforeEach(async () => {
  mockFiles.clear();
  mockDirs.clear();
  mockFailingWrites.clear();
  mockDb = createNodeSqliteDb();
  await runMigrations(mockDb.db);
});

afterEach(() => {
  mockDb.sqlite.close();
});

describe("writeExerciseImageFiles", () => {
  it("writes each stored image to a file and records its uri", async () => {
    insertLibraryExercises(3);

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 3, failed: 0 });
    expect(imageUris()).toEqual({ 1: uriFor(1), 2: uriFor(2), 3: uriFor(3) });
    expect(Array.from(mockFiles.get(uriFor(2))!)).toEqual(
      Array.from(bytesFor(2)),
    );
  });

  it("handles more rows than fit in one batch", async () => {
    insertLibraryExercises(120);

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 120, failed: 0 });
    expect(mockFiles.size).toBe(120);
    expect(Object.values(imageUris()).every((uri) => uri !== null)).toBe(true);
  });

  it("does nothing on a second run", async () => {
    insertLibraryExercises(3);
    await writeExerciseImageFiles();
    const before = imageUris();

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 0, failed: 0 });
    expect(imageUris()).toEqual(before);
  });

  // Each File is a native object, and this check runs on every boot.
  it("checks a finished library without a file object per exercise", async () => {
    insertLibraryExercises(120);
    await writeExerciseImageFiles();
    mockCounts.filesConstructed = 0;

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 0, failed: 0 });
    expect(mockCounts.filesConstructed).toBeLessThanOrEqual(1);
  });

  it("resumes with only the rows an interrupted run left behind", async () => {
    insertLibraryExercises(3);
    mockDirs.add(DIR);
    mockFiles.set(uriFor(1), bytesFor(1));
    mockDb.sqlite
      .prepare(`UPDATE exercises SET image_uri = ? WHERE exercise_id = 1`)
      .run(uriFor(1));

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 2, failed: 0 });
    expect(imageUris()).toEqual({ 1: uriFor(1), 2: uriFor(2), 3: uriFor(3) });
  });

  // A restored backup, or cleared app storage, keeps the uri but not the file.
  it("rewrites a file that is recorded but missing from disk", async () => {
    insertLibraryExercises(2);
    await writeExerciseImageFiles();
    mockFiles.delete(uriFor(2));

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 1, failed: 0 });
    expect(mockFiles.has(uriFor(2))).toBe(true);
  });

  it("repoints a uri recorded under a different document directory", async () => {
    insertLibraryExercises(1);
    mockDb.sqlite
      .prepare(`UPDATE exercises SET image_uri = ? WHERE exercise_id = 1`)
      .run("file:///old-container/exercise-images/1.webp");

    await writeExerciseImageFiles();

    expect(imageUris()).toEqual({ 1: uriFor(1) });
  });

  it("leaves image_uri empty when a write fails so readers fall back", async () => {
    insertLibraryExercises(3);
    mockFailingWrites.add("2.webp");

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 2, failed: 1 });
    expect(imageUris()).toEqual({ 1: uriFor(1), 2: null, 3: uriFor(3) });
  });

  it("clears a stale uri when its file cannot be rewritten", async () => {
    insertLibraryExercises(1);
    mockDb.sqlite
      .prepare(`UPDATE exercises SET image_uri = ? WHERE exercise_id = 1`)
      .run(uriFor(1));
    mockFailingWrites.add("1.webp");

    await writeExerciseImageFiles();

    expect(imageUris()).toEqual({ 1: null });
  });

  it("retries a failed write on the next run", async () => {
    insertLibraryExercises(1);
    mockFailingWrites.add("1.webp");
    await writeExerciseImageFiles();
    mockFailingWrites.clear();

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 1, failed: 0 });
    expect(imageUris()).toEqual({ 1: uriFor(1) });
  });

  it("leaves exercises without a stored image alone", async () => {
    mockDb.sqlite.exec(`
      INSERT INTO exercises (exercise_id, app_exercise_id, name, image_uri)
      VALUES (1, NULL, 'Custom', 'file:///doc/photo.jpg');
    `);

    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 0, failed: 0 });
    expect(imageUris()).toEqual({ 1: "file:///doc/photo.jpg" });
  });
});

// A restored database can record the same uris as the files already on this
// device while meaning different exercises by them: exercise ids are not the
// same on every install.
describe("forgetExerciseImageFiles", () => {
  it("makes the next run replace files left by the previous database", async () => {
    insertLibraryExercises(2);
    await writeExerciseImageFiles();
    const restoredBytes = new Uint8Array([9, 9, 9]);
    mockDb.sqlite
      .prepare(`UPDATE exercises SET image = ? WHERE exercise_id = 1`)
      .run(restoredBytes);

    await forgetExerciseImageFiles();
    const result = await writeExerciseImageFiles();

    expect(result).toEqual({ written: 2, failed: 0 });
    expect(Array.from(mockFiles.get(uriFor(1))!)).toEqual([9, 9, 9]);
    expect(imageUris()).toEqual({ 1: uriFor(1), 2: uriFor(2) });
  });

  it("keeps the photo uri of a custom exercise", async () => {
    mockDb.sqlite.exec(`
      INSERT INTO exercises (exercise_id, app_exercise_id, name, image_uri)
      VALUES (1, NULL, 'Custom', 'file:///doc/photo.jpg');
    `);

    await forgetExerciseImageFiles();

    expect(imageUris()).toEqual({ 1: "file:///doc/photo.jpg" });
  });
});
