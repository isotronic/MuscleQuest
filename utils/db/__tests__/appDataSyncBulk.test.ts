// A fresh install copies the shipped library with one ATTACH and a few
// INSERT ... SELECT statements instead of a lookup and insert per row.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyDataFromAppDataToUserData } from "@/utils/db/appDataSync";
import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockUserData: ReturnType<typeof createNodeSqliteDb>;
let mockAppDataPath: string;
const mockOpenDatabase = jest.fn();

jest.mock("@/utils/db/connection", () => ({
  openDatabase: (name: string) => mockOpenDatabase(name),
  databaseFilePath: () => mockAppDataPath,
}));

const IMAGE = new Uint8Array([7, 8, 9]);

const writeAppDataFile = (file: string) => {
  const sqlite = new DatabaseSync(file);
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
    INSERT INTO muscles VALUES ('chest'), ('quads');
    INSERT INTO body_parts VALUES ('upper arms');
    INSERT INTO equipment_list VALUES ('barbell');
  `);
  const insert = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, image, equipment, tracking_type, is_unilateral, double_weight)
     VALUES (?, ?, ?, 'barbell', 'weight', ?, 0)`,
  );
  insert.run(5, "Bench Press", IMAGE, 0);
  insert.run(9, "Lunge", null, 1);
  sqlite.close();
};

beforeEach(async () => {
  mockOpenDatabase.mockReset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "appdata-"));
  mockAppDataPath = path.join(dir, "appData3.db");
  writeAppDataFile(mockAppDataPath);
  mockUserData = createNodeSqliteDb();
  await runMigrations(mockUserData.db);
  mockOpenDatabase.mockImplementation(async (name: string) => {
    if (name === "userData.db") return mockUserData.db;
    throw new Error(`unexpected open of ${name}`);
  });
});

afterEach(() => {
  mockUserData.sqlite.close();
  fs.rmSync(path.dirname(mockAppDataPath), { recursive: true, force: true });
});

const rows = (sql: string) => mockUserData.sqlite.prepare(sql).all();

describe("copyDataFromAppDataToUserData on a fresh install", () => {
  it("copies every library exercise linked to its library id", async () => {
    await copyDataFromAppDataToUserData();

    expect(
      rows(
        `SELECT app_exercise_id, name, is_unilateral FROM exercises ORDER BY app_exercise_id`,
      ),
    ).toEqual([
      { app_exercise_id: 5, name: "Bench Press", is_unilateral: 0 },
      { app_exercise_id: 9, name: "Lunge", is_unilateral: 1 },
    ]);
    const bench = mockUserData.sqlite
      .prepare(`SELECT image FROM exercises WHERE app_exercise_id = 5`)
      .get() as { image: Uint8Array };
    expect(Array.from(bench.image)).toEqual(Array.from(IMAGE));
  });

  it("copies the lookup tables without duplicating existing values", async () => {
    mockUserData.sqlite.exec(`INSERT INTO muscles (muscle) VALUES ('chest')`);

    await copyDataFromAppDataToUserData();

    expect(rows(`SELECT muscle FROM muscles ORDER BY muscle`)).toEqual([
      { muscle: "chest" },
      { muscle: "quads" },
    ]);
    expect(rows(`SELECT body_part FROM body_parts`)).toEqual([
      { body_part: "upper arms" },
    ]);
    expect(rows(`SELECT equipment FROM equipment_list`)).toEqual([
      { equipment: "barbell" },
    ]);
  });

  it("keeps custom exercises and still adds the whole library", async () => {
    mockUserData.sqlite.exec(
      `INSERT INTO exercises (name, app_exercise_id) VALUES ('My custom', NULL)`,
    );

    await copyDataFromAppDataToUserData();

    expect(
      rows(`SELECT name FROM exercises ORDER BY exercise_id`).map(
        (r: any) => r.name,
      ),
    ).toEqual(["My custom", "Bench Press", "Lunge"]);
  });

  it("advances the sync version and detaches the library", async () => {
    await copyDataFromAppDataToUserData();

    expect(await getAppDataSyncVersion(mockUserData.db)).toBe(
      APP_DATA_SYNC.exercisesCopied,
    );
    expect(rows(`PRAGMA database_list`)).toHaveLength(1);
  });

  it("does not open the library database row by row", async () => {
    await copyDataFromAppDataToUserData();

    expect(mockOpenDatabase).not.toHaveBeenCalledWith("appData3.db");
  });

  it("reports the start and end of the copy", async () => {
    const onProgress = jest.fn();

    await copyDataFromAppDataToUserData(onProgress);

    expect(onProgress.mock.calls).toEqual([
      [0, 2],
      [2, 2],
    ]);
  });
});
