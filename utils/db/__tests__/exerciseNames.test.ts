// Library exercise names in the device language: loaded from the library's
// exercise_translations table, keyed by app_exercise_id, switchable to
// English, and never applied to custom exercises.
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteDb } from "@/utils/db/testing/nodeSqliteDb";
import {
  compareExerciseNames,
  displayExerciseName,
  exerciseNamesTranslated,
  hasExerciseNameTranslations,
  loadExerciseNames,
  setExerciseNamesTranslated,
  showsEnglishName,
  withDisplayExerciseName,
  withDisplayName,
} from "@/utils/db/exerciseNames";

let mockUserData: ReturnType<typeof createNodeSqliteDb>;
let mockLibrary: ReturnType<typeof createNodeSqliteDb>;

jest.mock("@/utils/db/connection", () => ({
  openDatabase: async (name: string) =>
    name === "userData.db" ? mockUserData.db : mockLibrary.db,
}));

const seedLibrary = (sqlite: DatabaseSync) =>
  sqlite.exec(`
    CREATE TABLE exercise_translations (
      exercise_id INTEGER NOT NULL, locale TEXT NOT NULL, name TEXT NOT NULL,
      PRIMARY KEY (exercise_id, locale)
    );
    INSERT INTO exercise_translations VALUES
      (11, 'de', 'Langhantel-Bankdrücken'),
      (11, 'fr', 'Développé couché à la barre'),
      (20, 'de', 'Langhantel-Kreuzheben');
  `);

const seedSettings = (value: string | null) => {
  mockUserData.sqlite.exec(
    `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)`,
  );
  if (value !== null) {
    mockUserData.sqlite
      .prepare(`INSERT INTO settings VALUES ('translateExerciseNames', ?)`)
      .run(value);
  }
};

beforeEach(() => {
  mockUserData = createNodeSqliteDb();
  mockLibrary = createNodeSqliteDb();
  seedLibrary(mockLibrary.sqlite);
});

afterEach(async () => {
  mockUserData.sqlite.close();
  mockLibrary.sqlite.close();
  // Module state outlives a test: back to English for the next one.
  await loadExerciseNames("en");
  setExerciseNamesTranslated(true);
});

describe("before anything is loaded", () => {
  it("shows the stored name", () => {
    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Barbell Bench Press",
    );
    expect(hasExerciseNameTranslations()).toBe(false);
  });
});

describe("loadExerciseNames", () => {
  it("translates library exercises into the device language", async () => {
    seedSettings("true");

    await loadExerciseNames("de");

    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Langhantel-Bankdrücken",
    );
    expect(hasExerciseNameTranslations()).toBe(true);
  });

  it("only loads the device language", async () => {
    seedSettings("true");

    await loadExerciseNames("fr");

    expect(displayExerciseName("Barbell Deadlift", 20)).toBe(
      "Barbell Deadlift",
    );
    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Développé couché à la barre",
    );
  });

  it("translates when the setting has never been written", async () => {
    seedSettings(null);

    await loadExerciseNames("de");

    expect(exerciseNamesTranslated()).toBe(true);
  });

  it("keeps English names when the user chose them", async () => {
    seedSettings("false");

    await loadExerciseNames("de");

    expect(exerciseNamesTranslated()).toBe(false);
    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Barbell Bench Press",
    );
    // The setting row still shows, so the user can switch back.
    expect(hasExerciseNameTranslations()).toBe(true);
  });

  it("reads nothing on an English device", async () => {
    // No settings table: any read would throw.
    await loadExerciseNames("en");

    expect(hasExerciseNameTranslations()).toBe(false);
  });

  it("fails without a translations table and leaves names in English", async () => {
    seedSettings("true");
    mockLibrary.sqlite.exec(`DROP TABLE exercise_translations`);

    await expect(loadExerciseNames("de")).rejects.toThrow();

    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Barbell Bench Press",
    );
  });
});

describe("displaying names", () => {
  beforeEach(async () => {
    seedSettings("true");
    await loadExerciseNames("de");
  });

  it("leaves custom exercises and untranslated ids alone", () => {
    expect(displayExerciseName("My Press", null)).toBe("My Press");
    expect(displayExerciseName("My Press", undefined)).toBe("My Press");
    expect(displayExerciseName("Barbell Curl", 999)).toBe("Barbell Curl");
  });

  it("switches to English and back at once", () => {
    setExerciseNamesTranslated(false);
    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Barbell Bench Press",
    );

    setExerciseNamesTranslated(true);
    expect(displayExerciseName("Barbell Bench Press", 11)).toBe(
      "Langhantel-Bankdrücken",
    );
  });

  it("keeps the English name beside the display name", () => {
    const row = withDisplayName({
      exercise_id: 3,
      app_exercise_id: 11,
      name: "Barbell Bench Press",
    });

    expect(row).toEqual({
      exercise_id: 3,
      app_exercise_id: 11,
      name: "Langhantel-Bankdrücken",
      english_name: "Barbell Bench Press",
    });
    expect(showsEnglishName(row)).toBe(true);
    expect(
      showsEnglishName(
        withDisplayName({ name: "My Press", app_exercise_id: null }),
      ),
    ).toBe(false);
  });

  it("swaps exercise_name in query rows", () => {
    expect(
      withDisplayExerciseName({
        exercise_name: "Barbell Deadlift",
        app_exercise_id: 20,
      }),
    ).toEqual({ exercise_name: "Langhantel-Kreuzheben", app_exercise_id: 20 });
    expect(
      withDisplayExerciseName({ exercise_name: null, app_exercise_id: 20 }),
    ).toEqual({ exercise_name: null, app_exercise_id: 20 });
  });

  it("orders names by the device language's alphabet", () => {
    const names = ["Zug", "Übung", "Arm", "Ast"];

    // German sorts Ü with U, not after Z as code points would.
    expect([...names].sort(compareExerciseNames)).toEqual([
      "Arm",
      "Ast",
      "Übung",
      "Zug",
    ]);
  });
});
