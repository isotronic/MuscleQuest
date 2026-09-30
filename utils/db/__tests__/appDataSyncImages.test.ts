// copyDataFromAppDataToUserData rewrites a library exercise's thumbnail bytes
// when the shipped library changes it. The thumbnail file written from the old
// bytes must not outlive that.
import { DatabaseSync } from "node:sqlite";
import { copyDataFromAppDataToUserData } from "@/utils/db/appDataSync";
import {
  APP_DATA_SYNC,
  setAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockUserData: ReturnType<typeof createNodeSqliteDb>;
let mockAppData: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: jest.fn(async (name: string) =>
    name === "userData.db" ? mockUserData.db : mockAppData.db,
  ),
}));

const OLD_IMAGE = new Uint8Array([1, 1, 1]);
const NEW_IMAGE = new Uint8Array([2, 2, 2]);

const seedAppData = (sqlite: DatabaseSync) => {
  sqlite.exec(`
    CREATE TABLE muscles (muscle TEXT PRIMARY KEY);
    CREATE TABLE body_parts (body_part TEXT PRIMARY KEY);
    CREATE TABLE equipment_list (equipment TEXT PRIMARY KEY);
    CREATE TABLE exercises (
      exercise_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, image BLOB, local_animated_uri TEXT, animated_url TEXT,
      equipment TEXT, body_part TEXT, target_muscle TEXT,
      secondary_muscles TEXT, description TEXT,
      is_deleted INTEGER DEFAULT (0), tracking_type TEXT,
      is_unilateral BOOLEAN DEFAULT FALSE, double_weight BOOLEAN DEFAULT FALSE
    );
  `);
  const insert = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, image, animated_url, description, tracking_type, is_deleted, is_unilateral, double_weight)
     VALUES (?, ?, ?, 'a.webp', 'd', 'weight', 0, 0, 0)`,
  );
  insert.run(1, "Bench Press (renamed)", NEW_IMAGE);
  insert.run(2, "Squat", OLD_IMAGE);
  insert.run(3, "Brand new", NEW_IMAGE);
};

const seedUserData = (sqlite: DatabaseSync) => {
  const insert = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, app_exercise_id, name, image, image_uri, animated_url, description, tracking_type, is_deleted, is_unilateral, double_weight)
     VALUES (?, ?, ?, ?, ?, 'a.webp', 'd', 'weight', 0, 0, 0)`,
  );
  insert.run(
    11,
    1,
    "Bench Press",
    OLD_IMAGE,
    "file:///doc/exercise-images/11.webp",
  );
  insert.run(12, 2, "Squat", OLD_IMAGE, "file:///doc/exercise-images/12.webp");
  insert.run(13, null, "My custom", null, "file:///doc/photo.jpg");
};

const userExercise = (id: number) =>
  mockUserData.sqlite
    .prepare(
      `SELECT name, image, image_uri FROM exercises WHERE exercise_id = ?`,
    )
    .get(id) as {
    name: string;
    image: Uint8Array | null;
    image_uri: string | null;
  };

beforeEach(async () => {
  mockAppData = createNodeSqliteDb();
  mockUserData = createNodeSqliteDb();
  seedAppData(mockAppData.sqlite);
  await runMigrations(mockUserData.db);
  seedUserData(mockUserData.sqlite);
  await setAppDataSyncVersion(mockUserData.db, APP_DATA_SYNC.exerciseIdsLinked);

  await copyDataFromAppDataToUserData();
});

afterEach(() => {
  mockAppData.sqlite.close();
  mockUserData.sqlite.close();
});

describe("copyDataFromAppDataToUserData and thumbnail files", () => {
  it("drops the file uri of an exercise whose library row was rewritten", () => {
    const bench = userExercise(11);

    expect(bench.name).toBe("Bench Press (renamed)");
    expect(Array.from(bench.image!)).toEqual(Array.from(NEW_IMAGE));
    // NULL sends readers back to the bytes until the file is rewritten.
    expect(bench.image_uri).toBeNull();
  });

  it("keeps a rewritten exercise linked to its library row", () => {
    expect(
      mockUserData.sqlite
        .prepare(`SELECT app_exercise_id FROM exercises WHERE exercise_id = 11`)
        .get(),
    ).toEqual({ app_exercise_id: 1 });
  });

  it("keeps the file uri of an exercise the library did not change", () => {
    expect(userExercise(12).image_uri).toBe(
      "file:///doc/exercise-images/12.webp",
    );
  });

  it("leaves custom exercises alone", () => {
    expect(userExercise(13)).toMatchObject({
      name: "My custom",
      image_uri: "file:///doc/photo.jpg",
    });
  });

  it("adds a new library exercise without a file uri", () => {
    const added = mockUserData.sqlite
      .prepare(`SELECT image_uri FROM exercises WHERE app_exercise_id = 3`)
      .get();

    expect(added).toEqual({ image_uri: null });
  });
});
