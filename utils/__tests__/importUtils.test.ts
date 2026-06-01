import { resolveExerciseId } from "@/utils/importUtils";
import { SharedExercise } from "@/types/firestore";
import { SQLiteDatabase } from "expo-sqlite";

const baseExercise: SharedExercise = {
  appExerciseId: null,
  name: "Cable Row",
  equipment: "cable",
  bodyPart: "back",
  targetMuscle: "lats",
  secondaryMuscles: ["biceps"],
  trackingType: "reps",
  isUnilateral: false,
  doubleWeight: false,
  animatedUrl: null,
  sets: [],
  exerciseOrder: 0,
  supersetGroupId: null,
  trackingTypeOverride: null,
};

const makeMockDb = (overrides: Partial<SQLiteDatabase> = {}) =>
  ({
    getFirstAsync: jest.fn(),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 99, changes: 1 }),
    ...overrides,
  }) as unknown as SQLiteDatabase;

describe("resolveExerciseId", () => {
  it("returns exercise_id from exercises table when appExerciseId is set and found", async () => {
    const db = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue({ exercise_id: 7 }),
    });
    const exercise: SharedExercise = { ...baseExercise, appExerciseId: 42 };
    const result = await resolveExerciseId(db, exercise);
    expect(result).toBe(7);
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      "SELECT exercise_id FROM exercises WHERE app_exercise_id = ? LIMIT 1",
      [42],
    );
  });

  it("returns existing custom exercise_id when custom exercise found by name", async () => {
    const db = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue({ exercise_id: 5 }),
    });
    const result = await resolveExerciseId(db, baseExercise);
    expect(result).toBe(5);
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      "SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND name = ? LIMIT 1",
      ["Cable Row"],
    );
  });

  it("inserts and returns new exercise_id when custom exercise not found", async () => {
    const db = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest
        .fn()
        .mockResolvedValue({ lastInsertRowId: 88, changes: 1 }),
    });
    const result = await resolveExerciseId(db, baseExercise);
    expect(result).toBe(88);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO exercises"),
      expect.arrayContaining(["Cable Row", "back", "lats", "cable"]),
    );
  });

  it("inserts custom exercise with JSON-encoded secondary_muscles", async () => {
    const db = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue(null),
      runAsync: jest
        .fn()
        .mockResolvedValue({ lastInsertRowId: 10, changes: 1 }),
    });
    await resolveExerciseId(db, {
      ...baseExercise,
      secondaryMuscles: ["biceps", "forearms"],
    });
    const insertArgs = (db.runAsync as jest.Mock).mock.calls[0][1];
    expect(insertArgs).toContain(JSON.stringify(["biceps", "forearms"]));
  });
});
