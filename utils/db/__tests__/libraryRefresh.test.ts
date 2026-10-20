// Existing installs get the audited library by rewriting their library rows.
// Where a tracking type changes from reps to time, what the user logged and
// planned is converted first, and only when the numbers look like seconds.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { refreshLibraryFromAppData } from "@/utils/db/appDataSync";
import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
  setAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";

let mockUserData: ReturnType<typeof createNodeSqliteDb>;
let mockAppDataPath: string;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: async (name: string) => {
    if (name === "userData.db") return mockUserData.db;
    throw new Error(`unexpected open of ${name}`);
  },
  databaseFilePath: () => mockAppDataPath,
}));

const OLD_IMAGE = new Uint8Array([1, 2, 3]);
const NEW_IMAGE = new Uint8Array([4, 5, 6]);

// Library ids: 5 renamed with a new thumbnail, 9 a hold now timed, 12 given
// an animation, 20 unchanged, 30 weight now reps, 40 new to the device.
const writeLibrary = (file: string) => {
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
    INSERT INTO muscles VALUES ('quads'), ('delts');
    INSERT INTO body_parts VALUES ('upper legs');
    INSERT INTO equipment_list VALUES ('barbell');
  `);
  const insert = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, name, image, animated_url, target_muscle, secondary_muscles, tracking_type, double_weight)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run(
    5,
    "Barbell Back Squat",
    NEW_IMAGE,
    "/a/squat.webp",
    "quads",
    '["glutes"]',
    null,
    0,
  );
  insert.run(
    9,
    "Side Plank",
    OLD_IMAGE,
    "/a/plank.webp",
    "abs",
    "[]",
    "time",
    0,
  );
  insert.run(
    12,
    "Pistol Squat",
    OLD_IMAGE,
    "/a/pistol.webp",
    "quads",
    "[]",
    "reps",
    0,
  );
  insert.run(
    30,
    "Ab Wheel",
    OLD_IMAGE,
    "/a/wheel.webp",
    "abs",
    "[]",
    "reps",
    0,
  );
  insert.run(
    40,
    "Front Plank",
    OLD_IMAGE,
    "/a/front.webp",
    "abs",
    "[]",
    "time",
    0,
  );
  insert.run(
    20,
    "Dumbbell Lunge",
    OLD_IMAGE,
    "/a/lunge.webp",
    "quads",
    "[]",
    null,
    1,
  );
  sqlite.close();
};

const seedUserData = (sqlite: DatabaseSync) => {
  // expo-sqlite leaves foreign keys off; Node's SQLite turns them on.
  sqlite.exec(`PRAGMA foreign_keys = OFF`);
  const insert = sqlite.prepare(
    `INSERT INTO exercises (exercise_id, app_exercise_id, name, image, image_uri, animated_url, local_animated_uri, target_muscle, secondary_muscles, tracking_type, double_weight, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run(
    105,
    5,
    "Barbell Full Squat",
    OLD_IMAGE,
    "file:///105.webp",
    "/a/squat.webp",
    "file:///anim105.webp",
    "glutes",
    '["quadriceps"]',
    null,
    0,
    1,
  );
  insert.run(
    109,
    9,
    "Side Bridge V. 2",
    OLD_IMAGE,
    "file:///109.webp",
    "/a/plank.webp",
    null,
    "abs",
    "[]",
    "reps",
    0,
    0,
  );
  insert.run(
    112,
    12,
    "Pistol Squat",
    OLD_IMAGE,
    "file:///112.webp",
    null,
    "file:///stale.webp",
    "quads",
    "[]",
    "reps",
    0,
    0,
  );
  insert.run(
    120,
    20,
    "Dumbbell Lunge",
    OLD_IMAGE,
    "file:///120.webp",
    "/a/lunge.webp",
    "file:///anim120.webp",
    "quads",
    "[]",
    null,
    1,
    0,
  );
  insert.run(
    130,
    30,
    "Ab Wheel",
    OLD_IMAGE,
    "file:///130.webp",
    "/a/wheel.webp",
    null,
    "abs",
    "[]",
    null,
    0,
    0,
  );
  insert.run(
    500,
    null,
    "My Plank",
    null,
    null,
    null,
    null,
    "abs",
    "[]",
    "reps",
    0,
    0,
  );
  sqlite.exec(
    `INSERT INTO completed_workouts (id, date_completed, local_date) VALUES (1, '2026-01-01T10:00:00.000Z', '2026-01-01')`,
  );
};

let nextSetId = 1;
const logSession = (
  id: number,
  exerciseId: number,
  snapshot: string | null,
  sets: { reps: number | null; deleted?: boolean }[],
  completedWorkoutId = 1,
) => {
  mockUserData.sqlite
    .prepare(
      `INSERT INTO completed_exercises (id, completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?, ?)`,
    )
    .run(id, completedWorkoutId, exerciseId, snapshot);
  sets.forEach((set, index) =>
    mockUserData.sqlite
      .prepare(
        `INSERT INTO completed_sets (id, completed_exercise_id, set_number, reps, is_deleted) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(nextSetId++, id, index + 1, set.reps, set.deleted ? 1 : 0),
  );
};

const planRow = (
  id: number,
  exerciseId: number,
  sets: object[],
  override: string | null = null,
) =>
  mockUserData.sqlite
    .prepare(
      `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, tracking_type_override) VALUES (?, 1, ?, ?, ?)`,
    )
    .run(id, exerciseId, JSON.stringify(sets), override);

const suggestion = (planRowId: number, applied: boolean) =>
  mockUserData.sqlite
    .prepare(
      `INSERT INTO exercise_progression_state (user_workout_exercise_id, suggestion_action, rule_key, rule_explanation, is_applied)
       VALUES (?, 'increase_reps', 'k', 'e', ?)`,
    )
    .run(planRowId, applied ? 1 : 0);

const rows = (sql: string, ...params: any[]) =>
  mockUserData.sqlite.prepare(sql).all(...params) as any[];
const row = (sql: string, ...params: any[]) =>
  mockUserData.sqlite.prepare(sql).get(...params) as any;

const session = (id: number) => ({
  type: row(
    `SELECT resolved_tracking_type AS t FROM completed_exercises WHERE id = ?`,
    id,
  ).t,
  sets: rows(
    `SELECT reps, time FROM completed_sets WHERE completed_exercise_id = ? ORDER BY set_number`,
    id,
  ),
});

const plan = (id: number) => {
  const r = row(
    `SELECT sets, tracking_type_override AS override FROM user_workout_exercises WHERE id = ?`,
    id,
  );
  return { sets: JSON.parse(r.sets), override: r.override };
};

beforeEach(async () => {
  nextSetId = 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "library-refresh-"));
  mockAppDataPath = path.join(dir, "appData4.db");
  writeLibrary(mockAppDataPath);
  mockUserData = createNodeSqliteDb();
  await runMigrations(mockUserData.db);
  seedUserData(mockUserData.sqlite);
  await setAppDataSyncVersion(
    mockUserData.db,
    APP_DATA_SYNC.exerciseFlagsResynced,
  );
});

afterEach(() => {
  mockUserData.sqlite.close();
  fs.rmSync(path.dirname(mockAppDataPath), { recursive: true, force: true });
});

describe("refreshLibraryFromAppData: library rows", () => {
  it("rewrites library content and keeps what belongs to the device", async () => {
    await refreshLibraryFromAppData();

    expect(
      row(
        `SELECT name, target_muscle, secondary_muscles, favorite, image_uri, local_animated_uri FROM exercises WHERE exercise_id = 105`,
      ),
    ).toEqual({
      name: "Barbell Back Squat",
      target_muscle: "quads",
      secondary_muscles: '["glutes"]',
      favorite: 1,
      // New thumbnail: the file written from the old bytes is dropped.
      image_uri: null,
      // Same animation: the downloaded file is still right.
      local_animated_uri: "file:///anim105.webp",
    });
  });

  it("drops a downloaded animation when the animation changes", async () => {
    await refreshLibraryFromAppData();

    expect(
      row(
        `SELECT animated_url, local_animated_uri, image_uri FROM exercises WHERE exercise_id = 112`,
      ),
    ).toEqual({
      animated_url: "/a/pistol.webp",
      local_animated_uri: null,
      image_uri: "file:///112.webp",
    });
  });

  it("leaves unchanged rows and custom exercises alone", async () => {
    await refreshLibraryFromAppData();

    expect(
      row(
        `SELECT name, image_uri, double_weight FROM exercises WHERE exercise_id = 120`,
      ),
    ).toEqual({
      name: "Dumbbell Lunge",
      image_uri: "file:///120.webp",
      double_weight: 1,
    });
    expect(
      row(`SELECT name, tracking_type FROM exercises WHERE exercise_id = 500`),
    ).toEqual({ name: "My Plank", tracking_type: "reps" });
  });

  it("adds lookup values the library has and the device lacks", async () => {
    await refreshLibraryFromAppData();

    expect(
      rows(
        `SELECT muscle FROM muscles WHERE muscle IN ('quads', 'delts') ORDER BY muscle`,
      ),
    ).toEqual([{ muscle: "delts" }, { muscle: "quads" }]);
  });

  it("advances the sync version and detaches the library", async () => {
    await refreshLibraryFromAppData();

    expect(await getAppDataSyncVersion(mockUserData.db)).toBe(
      APP_DATA_SYNC.libraryRefreshed,
    );
    expect(rows(`PRAGMA database_list`)).toHaveLength(1);
  });

  it("does nothing once it has run", async () => {
    await setAppDataSyncVersion(
      mockUserData.db,
      APP_DATA_SYNC.libraryRefreshed,
    );

    await refreshLibraryFromAppData();

    expect(row(`SELECT name FROM exercises WHERE exercise_id = 105`).name).toBe(
      "Barbell Full Squat",
    );
  });

  it("changes nothing when the rows already match the library", async () => {
    await refreshLibraryFromAppData();
    const before = rows(`SELECT * FROM exercises ORDER BY exercise_id`);
    await setAppDataSyncVersion(
      mockUserData.db,
      APP_DATA_SYNC.exerciseFlagsResynced,
    );

    await refreshLibraryFromAppData();

    expect(rows(`SELECT * FROM exercises ORDER BY exercise_id`)).toEqual(
      before,
    );
  });
});

describe("refreshLibraryFromAppData: history of an exercise now timed", () => {
  it("converts a session whose every set looks like seconds", async () => {
    logSession(1, 109, "reps", [
      { reps: 30 },
      { reps: 45 },
      { reps: 2, deleted: true },
    ]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "time",
      sets: [
        { reps: null, time: 30 },
        { reps: null, time: 45 },
        { reps: null, time: 2 },
      ],
    });
  });

  it("keeps a session as reps when a set is below the threshold", async () => {
    logSession(1, 109, "reps", [{ reps: 30 }, { reps: 3 }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "reps",
      sets: [
        { reps: 30, time: null },
        { reps: 3, time: null },
      ],
    });
  });

  it("locks the old type on sessions logged before the snapshot existed", async () => {
    logSession(1, 109, null, [{ reps: 40 }]);
    logSession(2, 109, "", [{ reps: 50 }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "time",
      sets: [{ reps: null, time: 40 }],
    });
    expect(session(2)).toEqual({
      type: "time",
      sets: [{ reps: null, time: 50 }],
    });
  });

  it("keeps every session on reps when any of them looks like a count", async () => {
    logSession(1, 109, null, [{ reps: 1 }]);
    logSession(2, 109, "reps", [{ reps: 40 }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "reps",
      sets: [{ reps: 1, time: null }],
    });
    expect(session(2)).toEqual({
      type: "reps",
      sets: [{ reps: 40, time: null }],
    });
  });

  it("leaves sessions logged as another type", async () => {
    logSession(1, 109, "weight", [{ reps: 30 }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "weight",
      sets: [{ reps: 30, time: null }],
    });
  });

  it("does not touch custom exercises or exercises whose type stays", async () => {
    logSession(1, 500, "reps", [{ reps: 30 }]);
    logSession(2, 112, null, [{ reps: 30 }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "reps",
      sets: [{ reps: 30, time: null }],
    });
    expect(session(2)).toEqual({
      type: null,
      sets: [{ reps: 30, time: null }],
    });
  });
});

describe("refreshLibraryFromAppData: plans with an exercise now timed", () => {
  const rest = { restMinutes: 1, restSeconds: 0 };

  it("turns rep targets that look like seconds into time targets", async () => {
    planRow(1, 109, [
      { repsMin: 20, repsMax: 30, time: undefined, ...rest },
      { repsMin: 45, ...rest, isWarmup: true },
      { ...rest },
    ]);
    suggestion(1, false);

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({
      override: null,
      sets: [
        { ...rest, time: 30 },
        { ...rest, isWarmup: true, time: 45 },
        { ...rest },
      ],
    });
    expect(rows(`SELECT id FROM exercise_progression_state`)).toEqual([]);
  });

  it("keeps an applied suggestion", async () => {
    planRow(1, 109, [{ repsMin: 30, repsMax: 30, ...rest }]);
    suggestion(1, true);

    await refreshLibraryFromAppData();

    expect(rows(`SELECT is_applied FROM exercise_progression_state`)).toEqual([
      { is_applied: 1 },
    ]);
  });

  it("keeps small targets on reps through the plan's override", async () => {
    const sets = [
      { repsMin: 1, repsMax: 1, ...rest },
      { repsMin: 30, ...rest },
    ];
    planRow(1, 109, sets);
    suggestion(1, false);

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({ override: "reps", sets });
    expect(rows(`SELECT id FROM exercise_progression_state`)).toHaveLength(1);
  });

  it("keeps sessions and plans together: a small plan target keeps both on reps", async () => {
    logSession(1, 109, "reps", [{ reps: 30 }]);
    planRow(1, 109, [{ repsMin: 30, ...rest }]);
    planRow(2, 109, [{ repsMin: 2, ...rest }]);

    await refreshLibraryFromAppData();

    expect(session(1)).toEqual({
      type: "reps",
      sets: [{ reps: 30, time: null }],
    });
    expect(plan(1).override).toBe("reps");
    expect(plan(2).override).toBe("reps");
  });

  it("keeps plans on reps when a session looks like a count", async () => {
    logSession(1, 109, "reps", [{ reps: 2 }]);
    planRow(1, 109, [{ repsMin: 30, ...rest }]);

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({
      override: "reps",
      sets: [{ repsMin: 30, ...rest }],
    });
  });

  it("converts nothing when a plan already pins the exercise to reps", async () => {
    logSession(1, 109, "reps", [{ reps: 30 }]);
    planRow(1, 109, [{ repsMin: 30, ...rest }], "reps");
    planRow(2, 109, [{ repsMin: 30, ...rest }]);

    await refreshLibraryFromAppData();

    expect(session(1).type).toBe("reps");
    expect(plan(2)).toEqual({
      override: "reps",
      sets: [{ repsMin: 30, ...rest }],
    });
  });

  it("converts plans with no targets", async () => {
    planRow(1, 109, []);
    mockUserData.sqlite.exec(
      `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets) VALUES (2, 1, 109, NULL)`,
    );
    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({ override: null, sets: [] });
    expect(plan(2)).toEqual({ override: null, sets: [] });
  });

  it("keeps an unreadable plan on reps", async () => {
    mockUserData.sqlite.exec(
      `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets) VALUES (1, 1, 109, 'not json')`,
    );

    await refreshLibraryFromAppData();

    expect(
      row(
        `SELECT tracking_type_override AS o FROM user_workout_exercises WHERE id = 1`,
      ).o,
    ).toBe("reps");
  });

  it("leaves rows that already choose a type", async () => {
    const sets = [{ repsMin: 30, ...rest }];
    planRow(1, 109, sets, "weight");

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({ override: "weight", sets });
  });
});

describe("refreshLibraryFromAppData: deleted and malformed rows", () => {
  const rest = { restMinutes: 1, restSeconds: 0 };
  const rawPlan = (id: number, sets: string, deleted = 0) =>
    mockUserData.sqlite
      .prepare(
        `INSERT INTO user_workout_exercises (id, workout_id, exercise_id, sets, is_deleted) VALUES (?, 1, 109, ?, ?)`,
      )
      .run(id, sets, deleted);

  it("lets deleted sessions and plan rows follow, not decide", async () => {
    logSession(1, 109, "reps", [{ reps: 30 }]);
    logSession(2, 109, "reps", [{ reps: 1 }]);
    mockUserData.sqlite.exec(
      `UPDATE completed_exercises SET is_deleted = 1 WHERE id = 2`,
    );
    // A session whose whole workout was deleted.
    mockUserData.sqlite.exec(
      `INSERT INTO completed_workouts (id, date_completed, local_date, is_deleted) VALUES (2, '2026-01-02T10:00:00.000Z', '2026-01-02', 1)`,
    );
    logSession(3, 109, "reps", [{ reps: 1 }], 2);
    rawPlan(1, JSON.stringify([{ repsMin: 30, ...rest }]));
    rawPlan(2, JSON.stringify([{ repsMin: 2, ...rest }]), 1);

    await refreshLibraryFromAppData();

    expect(session(1).type).toBe("time");
    expect(session(2).type).toBe("time");
    expect(session(3).type).toBe("time");
    expect(plan(1)).toEqual({ override: null, sets: [{ ...rest, time: 30 }] });
    expect(plan(2)).toEqual({ override: null, sets: [{ ...rest, time: 2 }] });
  });

  it("keeps a plan with a null set on reps instead of failing", async () => {
    rawPlan(1, JSON.stringify([{ repsMin: 30, ...rest }, null]));

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({
      override: "reps",
      sets: [{ repsMin: 30, ...rest }, null],
    });
  });

  it("keeps targets that are not a list on reps, unchanged", async () => {
    rawPlan(1, JSON.stringify({ repsMin: 30 }));

    await refreshLibraryFromAppData();

    expect(plan(1)).toEqual({ override: "reps", sets: { repsMin: 30 } });
  });

  it("leaves a deleted plan it cannot read on reps when converting", async () => {
    rawPlan(1, JSON.stringify([{ repsMin: 30, ...rest }]));
    rawPlan(2, "not json", 1);

    await refreshLibraryFromAppData();

    expect(plan(1).override).toBeNull();
    expect(
      row(
        `SELECT sets, tracking_type_override AS o FROM user_workout_exercises WHERE id = 2`,
      ),
    ).toEqual({ sets: "not json", o: "reps" });
  });
});

describe("refreshLibraryFromAppData: other type changes", () => {
  it("keeps sessions and plans on the old type", async () => {
    logSession(1, 130, null, [{ reps: 10 }]);
    planRow(1, 130, [
      { repsMin: 8, repsMax: 12, restMinutes: 1, restSeconds: 0 },
    ]);

    await refreshLibraryFromAppData();

    expect(session(1).type).toBe("weight");
    expect(plan(1).override).toBe("weight");
    expect(
      row(`SELECT tracking_type FROM exercises WHERE exercise_id = 130`)
        .tracking_type,
    ).toBe("reps");
  });
});

describe("refreshLibraryFromAppData: missing library rows", () => {
  it("adds library exercises the device never received", async () => {
    await refreshLibraryFromAppData();

    expect(
      rows(
        `SELECT name, tracking_type, image_uri FROM exercises WHERE app_exercise_id = 40`,
      ),
    ).toEqual([
      { name: "Front Plank", tracking_type: "time", image_uri: null },
    ]);
  });
});

describe("refreshLibraryFromAppData: failure", () => {
  it("rolls everything back and runs again next time", async () => {
    logSession(1, 109, "reps", [{ reps: 30 }]);
    planRow(1, 109, [{ repsMin: 30 }]);
    const runAsync = mockUserData.db.runAsync;
    const spy = jest
      .spyOn(mockUserData.db, "runAsync")
      .mockImplementation(async (sql: any, ...params: any[]) => {
        if (String(sql).includes("UPDATE main.exercises")) {
          throw new Error("disk full");
        }
        return (runAsync as any)(sql, ...params);
      });

    await expect(refreshLibraryFromAppData()).rejects.toThrow("disk full");

    expect(session(1)).toEqual({
      type: "reps",
      sets: [{ reps: 30, time: null }],
    });
    expect(plan(1).sets).toEqual([{ repsMin: 30 }]);
    expect(await getAppDataSyncVersion(mockUserData.db)).toBe(
      APP_DATA_SYNC.exerciseFlagsResynced,
    );
    expect(rows(`PRAGMA database_list`)).toHaveLength(1);

    spy.mockRestore();
    await refreshLibraryFromAppData();
    expect(session(1).type).toBe("time");
  });
});
