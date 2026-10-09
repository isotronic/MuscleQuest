import { SQLiteDatabase } from "expo-sqlite";
import { SharedExercise } from "@/types/firestore";
import type { Set as PlanSet } from "@/store/workoutStore";

// Shared plans and workouts are written by another user's device, so nothing
// in them is trusted: the rules only bound their size, not their shape.

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportValidationError";
  }
}

/** Far more sets than any real exercise has. */
export const MAX_IMPORTED_SETS = 50;

// Upper bounds well past anything real, so a bad value cannot break layouts
// or arithmetic downstream.
const SET_FIELD_MAX = {
  repsMin: 1000,
  repsMax: 1000,
  restMinutes: 60,
  restSeconds: 59,
  time: 86_400, // seconds
  distance: 1_000_000, // metres
} as const;

const TRACKING_TYPES = new Set([
  "weight",
  "reps",
  "time",
  "distance",
  "assisted",
]);

const MAX_SUPERSET_GROUP_ID_LENGTH = 64;

/** A finite, non-negative number clamped to max, or undefined. */
const toBoundedNumber = (value: unknown, max: number): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, max);
};

/**
 * Turns the sets of an imported exercise into the local set shape, keeping
 * only known fields. Throws ImportValidationError when the value is not a
 * list or is implausibly long.
 */
export const sanitizeImportedSets = (raw: unknown): PlanSet[] => {
  if (!Array.isArray(raw)) {
    throw new ImportValidationError("Imported sets are not a list");
  }
  if (raw.length > MAX_IMPORTED_SETS) {
    throw new ImportValidationError(
      `Imported exercise has ${raw.length} sets (limit ${MAX_IMPORTED_SETS})`,
    );
  }
  return raw.map((entry): PlanSet => {
    const set =
      entry !== null && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};
    return {
      repsMin: toBoundedNumber(set.repsMin, SET_FIELD_MAX.repsMin),
      repsMax: toBoundedNumber(set.repsMax, SET_FIELD_MAX.repsMax),
      restMinutes:
        toBoundedNumber(set.restMinutes, SET_FIELD_MAX.restMinutes) ?? 0,
      restSeconds:
        toBoundedNumber(set.restSeconds, SET_FIELD_MAX.restSeconds) ?? 0,
      time: toBoundedNumber(set.time, SET_FIELD_MAX.time),
      distance: toBoundedNumber(set.distance, SET_FIELD_MAX.distance),
      isWarmup: set.isWarmup === true,
      isDropSet: set.isDropSet === true,
      isToFailure: set.isToFailure === true,
    };
  });
};

export const sanitizeSupersetGroupId = (raw: unknown): string | null =>
  typeof raw === "string" &&
  raw.length > 0 &&
  raw.length <= MAX_SUPERSET_GROUP_ID_LENGTH
    ? raw
    : null;

export const sanitizeTrackingTypeOverride = (raw: unknown): string | null =>
  typeof raw === "string" && TRACKING_TYPES.has(raw) ? raw : null;

/** The value as a list, or an ImportValidationError naming what it was. */
export const requireImportedList = (raw: unknown, what: string): unknown[] => {
  if (!Array.isArray(raw)) {
    throw new ImportValidationError(`Imported ${what} are not a list`);
  }
  return raw;
};

const requireImportedObject = (
  raw: unknown,
  what: string,
): Record<string, unknown> => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ImportValidationError(`Imported ${what} is not an object`);
  }
  return raw as Record<string, unknown>;
};

/**
 * A shared workout's exercises, each checked and sanitised. The rules bound
 * the list's length, not its shape.
 */
export const sanitizeImportedExercises = (raw: unknown): ImportedExercise[] =>
  requireImportedList(raw, "exercises").map((exercise) =>
    sanitizeImportedExercise(
      requireImportedObject(exercise, "exercise") as unknown as SharedExercise,
    ),
  );

/** A shared plan's workouts with their exercises; see sanitizeImportedExercises. */
export const sanitizeImportedWorkouts = (
  raw: unknown,
): { name: string; exercises: ImportedExercise[] }[] =>
  requireImportedList(raw, "workouts").map((entry) => {
    const workout = requireImportedObject(entry, "workout");
    return {
      name: typeof workout.name === "string" ? workout.name : "",
      exercises: sanitizeImportedExercises(workout.exercises),
    };
  });

export type ImportedExercise = Omit<SharedExercise, "sets"> & {
  sets: PlanSet[];
};

const isString = (value: unknown): value is string => typeof value === "string";

/**
 * The fields resolveExerciseId looks up or writes into a new custom exercise.
 * A wrong type would otherwise fail inside the transaction with a raw SQLite
 * error, or store an object as text. trackingType is passed through as before.
 */
const validateExerciseFields = (
  exercise: SharedExercise,
): Pick<
  SharedExercise,
  | "appExerciseId"
  | "name"
  | "bodyPart"
  | "targetMuscle"
  | "equipment"
  | "secondaryMuscles"
  | "isUnilateral"
  | "doubleWeight"
  | "animatedUrl"
> => {
  const invalid = (field: string) =>
    new ImportValidationError(`Imported exercise has an invalid ${field}`);
  const {
    appExerciseId,
    name,
    bodyPart,
    targetMuscle,
    equipment,
    secondaryMuscles,
    isUnilateral,
    doubleWeight,
    animatedUrl,
  } = exercise as unknown as Record<string, unknown>;

  if (
    appExerciseId !== null &&
    !(Number.isInteger(appExerciseId) && (appExerciseId as number) > 0)
  ) {
    throw invalid("appExerciseId");
  }
  if (!isString(name) || name.length === 0) throw invalid("name");
  if (!isString(bodyPart)) throw invalid("bodyPart");
  if (!isString(targetMuscle)) throw invalid("targetMuscle");
  if (!isString(equipment)) throw invalid("equipment");
  if (!Array.isArray(secondaryMuscles) || !secondaryMuscles.every(isString)) {
    throw invalid("secondaryMuscles");
  }
  if (typeof isUnilateral !== "boolean") throw invalid("isUnilateral");
  if (typeof doubleWeight !== "boolean") throw invalid("doubleWeight");
  if (animatedUrl !== null && !isString(animatedUrl)) {
    throw invalid("animatedUrl");
  }

  return {
    appExerciseId: appExerciseId as number | null,
    name,
    bodyPart,
    targetMuscle,
    equipment,
    secondaryMuscles,
    isUnilateral,
    doubleWeight,
    animatedUrl: animatedUrl as string | null,
  };
};

/**
 * Sanitises the parts of a shared exercise that are stored as-is on the plan.
 * Run it over the whole import before writing, so a bad exercise rejects the
 * import instead of leaving half of it behind.
 */
export const sanitizeImportedExercise = (
  exercise: SharedExercise,
): ImportedExercise => ({
  ...exercise,
  ...validateExerciseFields(exercise),
  sets: sanitizeImportedSets(exercise.sets),
  supersetGroupId: sanitizeSupersetGroupId(exercise.supersetGroupId),
  trackingTypeOverride: sanitizeTrackingTypeOverride(
    exercise.trackingTypeOverride,
  ),
});

/**
 * Resolves a SharedExercise to a local exercise_id in userData.db.
 * For app exercises: looks up by app_exercise_id (must already exist — call
 * ensureAppExercisesExist before starting the transaction).
 * For custom exercises: matches by name (app_exercise_id IS NULL), inserting
 * a new row if no match is found.
 */
export const resolveExerciseId = async (
  db: SQLiteDatabase,
  exercise: Omit<SharedExercise, "sets">,
): Promise<number> => {
  if (exercise.appExerciseId !== null) {
    const row = await db.getFirstAsync<{ exercise_id: number }>(
      "SELECT exercise_id FROM exercises WHERE app_exercise_id = ? LIMIT 1",
      [exercise.appExerciseId],
    );
    if (!row)
      throw new Error(
        `App exercise ${exercise.appExerciseId} not found in userData.db`,
      );
    return row.exercise_id;
  }

  const existing = await db.getFirstAsync<{ exercise_id: number }>(
    "SELECT exercise_id FROM exercises WHERE app_exercise_id IS NULL AND name = ? LIMIT 1",
    [exercise.name],
  );
  if (existing) return existing.exercise_id;

  const result = await db.runAsync(
    `INSERT INTO exercises (app_exercise_id, name, body_part, target_muscle, equipment, secondary_muscles, tracking_type, is_unilateral, double_weight, animated_url)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.name,
      exercise.bodyPart,
      exercise.targetMuscle,
      exercise.equipment,
      JSON.stringify(exercise.secondaryMuscles),
      exercise.trackingType,
      exercise.isUnilateral ? 1 : 0,
      exercise.doubleWeight ? 1 : 0,
      exercise.animatedUrl,
    ],
  );
  return result.lastInsertRowId;
};
