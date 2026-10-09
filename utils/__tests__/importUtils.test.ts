import {
  ImportValidationError,
  MAX_IMPORTED_SETS,
  resolveExerciseId,
  sanitizeImportedSets,
  sanitizeSupersetGroupId,
  sanitizeTrackingTypeOverride,
} from "@/utils/importUtils";
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

describe("sanitizeImportedSets", () => {
  it("keeps a well-formed set as the local set shape", () => {
    expect(
      sanitizeImportedSets([
        {
          repsMin: 8,
          repsMax: 12,
          restMinutes: 1,
          restSeconds: 30,
          time: null,
          distance: null,
          isWarmup: false,
          isDropSet: true,
          isToFailure: false,
        },
      ]),
    ).toEqual([
      {
        repsMin: 8,
        repsMax: 12,
        restMinutes: 1,
        restSeconds: 30,
        time: undefined,
        distance: undefined,
        isWarmup: false,
        isDropSet: true,
        isToFailure: false,
      },
    ]);
  });

  it("coerces numeric strings and drops what is not a finite number", () => {
    const [set] = sanitizeImportedSets([
      { repsMin: "10", repsMax: "abc", restMinutes: "2", time: Infinity },
    ]);
    expect(set.repsMin).toBe(10);
    expect(set.repsMax).toBeUndefined();
    expect(set.restMinutes).toBe(2);
    expect(set.time).toBeUndefined();
  });

  it("drops negative values and defaults rest to zero", () => {
    const [set] = sanitizeImportedSets([
      { repsMin: -5, restMinutes: -1, restSeconds: -30, distance: -100 },
    ]);
    expect(set.repsMin).toBeUndefined();
    expect(set.distance).toBeUndefined();
    expect(set.restMinutes).toBe(0);
    expect(set.restSeconds).toBe(0);
  });

  it("clamps absurd values", () => {
    const [set] = sanitizeImportedSets([
      { repsMin: 1e9, restMinutes: 1e6, restSeconds: 500, time: 1e12 },
    ]);
    expect(set.repsMin).toBe(1000);
    expect(set.restMinutes).toBe(60);
    expect(set.restSeconds).toBe(59);
    expect(set.time).toBe(86400);
  });

  it("only treats literal true as true", () => {
    const [set] = sanitizeImportedSets([
      { isWarmup: "yes", isDropSet: 1, isToFailure: true },
    ]);
    expect(set.isWarmup).toBe(false);
    expect(set.isDropSet).toBe(false);
    expect(set.isToFailure).toBe(true);
  });

  it("drops unknown keys", () => {
    const [set] = sanitizeImportedSets([{ repsMin: 5, injected: "<script>" }]);
    expect(set).not.toHaveProperty("injected");
  });

  it("treats a non-object entry as an empty set", () => {
    expect(sanitizeImportedSets(["nope"])).toEqual([
      {
        repsMin: undefined,
        repsMax: undefined,
        restMinutes: 0,
        restSeconds: 0,
        time: undefined,
        distance: undefined,
        isWarmup: false,
        isDropSet: false,
        isToFailure: false,
      },
    ]);
  });

  it("rejects something that is not an array", () => {
    expect(() => sanitizeImportedSets({ length: 3 })).toThrow(
      ImportValidationError,
    );
    expect(() => sanitizeImportedSets("[]")).toThrow(ImportValidationError);
  });

  it("rejects more sets than any real exercise has", () => {
    expect(() =>
      sanitizeImportedSets(
        Array.from({ length: MAX_IMPORTED_SETS + 1 }, () => ({})),
      ),
    ).toThrow(ImportValidationError);
    expect(
      sanitizeImportedSets(
        Array.from({ length: MAX_IMPORTED_SETS }, () => ({})),
      ),
    ).toHaveLength(MAX_IMPORTED_SETS);
  });
});

describe("sanitizeSupersetGroupId", () => {
  it("keeps a short string", () => {
    expect(sanitizeSupersetGroupId("ss-1")).toBe("ss-1");
  });

  it("drops anything else", () => {
    expect(sanitizeSupersetGroupId(42)).toBeNull();
    expect(sanitizeSupersetGroupId("")).toBeNull();
    expect(sanitizeSupersetGroupId("x".repeat(65))).toBeNull();
    expect(sanitizeSupersetGroupId(undefined)).toBeNull();
  });
});

describe("sanitizeTrackingTypeOverride", () => {
  it("keeps a known tracking type", () => {
    expect(sanitizeTrackingTypeOverride("weight")).toBe("weight");
    expect(sanitizeTrackingTypeOverride("assisted")).toBe("assisted");
  });

  it("drops an unknown one", () => {
    expect(sanitizeTrackingTypeOverride("rocket")).toBeNull();
    expect(sanitizeTrackingTypeOverride(null)).toBeNull();
  });
});
