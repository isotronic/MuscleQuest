import { Directory } from "expo-file-system";
import Constants from "expo-constants";
import { openDatabase } from "./database";
import type * as SQLite from "expo-sqlite";

export type ExportFormat = "csv" | "json";

export interface ExportFile {
  name: string;
  mimeType: string;
  content: string;
}

// Stored values are canonical, whatever the user's display units are.
export const EXPORT_UNITS = {
  weight: "kg",
  distance: "m",
  length: "cm",
} as const;

// Workouts are read a page at a time so a long history is never pulled in a
// single join.
const WORKOUT_PAGE_SIZE = 200;

// Bookkeeping flags that mean nothing to the user.
const INTERNAL_SETTING_KEYS = new Set([
  "dataVersion",
  "loginShown",
  "databaseRestored",
]);
const INTERNAL_SETTING_PATTERN = /(_backfill_completed|_v\d+)$/;

interface WorkoutRow {
  id: number;
  date_completed: string;
  duration: number | null;
  is_deload: number;
  workout_name: string | null;
  plan_name: string | null;
}

interface SetRow {
  completed_workout_id: number;
  completed_exercise_id: number;
  exercise_name: string | null;
  tracking_type: string | null;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: number | null;
  is_drop_set: number | null;
  is_to_failure: number | null;
}

interface MeasurementRow {
  entry_id: number;
  recorded_at: string;
  key: string;
  label: string;
  value_kind: "mass" | "length" | "percent";
  value: number;
}

export interface ExportedSet {
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

export interface ExportedWorkout {
  date: string;
  name: string | null;
  plan: string | null;
  durationSeconds: number | null;
  isDeload: boolean;
  exercises: {
    name: string | null;
    trackingType: string | null;
    sets: ExportedSet[];
  }[];
}

const bool = (value: number | null) => Boolean(value);

// Yields completed workouts oldest first with their exercises and sets, one
// page at a time.
async function* readWorkoutPages(
  db: SQLite.SQLiteDatabase,
): AsyncGenerator<{ workout: WorkoutRow; sets: SetRow[] }[]> {
  let lastDate = "";
  let lastId = 0;
  for (;;) {
    const workouts = await db.getAllAsync<WorkoutRow>(
      `SELECT cw.id, cw.date_completed, cw.duration, cw.is_deload,
              uw.name AS workout_name, up.name AS plan_name
         FROM completed_workouts cw
         LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
         LEFT JOIN user_plans up ON up.id = cw.plan_id
        WHERE cw.is_deleted = 0
          AND (cw.date_completed > ? OR (cw.date_completed = ? AND cw.id > ?))
        ORDER BY cw.date_completed, cw.id
        LIMIT ?`,
      [lastDate, lastDate, lastId, WORKOUT_PAGE_SIZE],
    );
    if (workouts.length === 0) return;

    const ids = workouts.map((w) => w.id);
    const sets = await db.getAllAsync<SetRow>(
      `SELECT ce.completed_workout_id, ce.id AS completed_exercise_id,
              e.name AS exercise_name,
              COALESCE(ce.resolved_tracking_type, e.tracking_type) AS tracking_type,
              cs.set_number, cs.weight, cs.reps, cs.time, cs.distance,
              cs.is_warmup, cs.is_drop_set, cs.is_to_failure
         FROM completed_exercises ce
         LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id
         JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
        WHERE ce.completed_workout_id IN (${ids.map(() => "?").join(",")})
          AND ce.is_deleted = 0 AND cs.is_deleted = 0
        ORDER BY ce.completed_workout_id, ce.id, cs.set_number, cs.id`,
      ids,
    );

    const setsByWorkout = new Map<number, SetRow[]>();
    for (const set of sets) {
      const list = setsByWorkout.get(set.completed_workout_id) ?? [];
      list.push(set);
      setsByWorkout.set(set.completed_workout_id, list);
    }
    yield workouts.map((workout) => ({
      workout,
      sets: setsByWorkout.get(workout.id) ?? [],
    }));

    const last = workouts[workouts.length - 1];
    lastDate = last.date_completed;
    lastId = last.id;
    if (workouts.length < WORKOUT_PAGE_SIZE) return;
  }
}

const toExportedWorkout = (
  workout: WorkoutRow,
  sets: SetRow[],
): ExportedWorkout => {
  const exercises: ExportedWorkout["exercises"] = [];
  let currentExerciseId: number | null = null;
  for (const set of sets) {
    if (set.completed_exercise_id !== currentExerciseId) {
      currentExerciseId = set.completed_exercise_id;
      exercises.push({
        name: set.exercise_name,
        trackingType: set.tracking_type,
        sets: [],
      });
    }
    exercises[exercises.length - 1].sets.push({
      setNumber: set.set_number,
      weight: set.weight,
      reps: set.reps,
      time: set.time,
      distance: set.distance,
      isWarmup: bool(set.is_warmup),
      isDropSet: bool(set.is_drop_set),
      isToFailure: bool(set.is_to_failure),
    });
  }
  return {
    date: workout.date_completed,
    name: workout.workout_name,
    plan: workout.plan_name,
    durationSeconds: workout.duration,
    isDeload: bool(workout.is_deload),
    exercises,
  };
};

const readMeasurements = (db: SQLite.SQLiteDatabase) =>
  db.getAllAsync<MeasurementRow>(
    `SELECT e.id AS entry_id, e.recorded_at, d.key, d.label, d.value_kind, v.value
       FROM body_measurement_entries e
       JOIN body_measurement_values v ON v.entry_id = e.id
       JOIN body_metric_definitions d ON d.id = v.metric_id
      ORDER BY e.recorded_at, e.id, d.sort_order`,
  );

const groupMeasurements = (rows: MeasurementRow[]) => {
  const entries = new Map<
    number,
    { date: string; values: Record<string, number> }
  >();
  for (const row of rows) {
    const entry = entries.get(row.entry_id) ?? {
      date: row.recorded_at,
      values: {},
    };
    entry.values[row.key] = row.value;
    entries.set(row.entry_id, entry);
  }
  return [...entries.values()];
};

const readSettings = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings ORDER BY key`,
  );
  return Object.fromEntries(
    rows
      .filter(
        (r) =>
          !INTERNAL_SETTING_KEYS.has(r.key) &&
          !INTERNAL_SETTING_PATTERN.test(r.key),
      )
      .map((r) => [r.key, r.value]),
  );
};

const readPlans = async (db: SQLite.SQLiteDatabase) => {
  const rows = await db.getAllAsync<{
    plan_id: number;
    plan_name: string;
    is_active: number;
    workout_id: number | null;
    workout_name: string | null;
    exercise_name: string | null;
    sets: string | null;
    superset_group_id: string | null;
  }>(
    `SELECT up.id AS plan_id, up.name AS plan_name, up.is_active,
            uw.id AS workout_id, uw.name AS workout_name,
            e.name AS exercise_name, uwe.sets, uwe.superset_group_id
       FROM user_plans up
       LEFT JOIN user_workouts uw ON uw.plan_id = up.id AND uw.is_deleted = 0
       LEFT JOIN user_workout_exercises uwe
              ON uwe.workout_id = uw.id AND uwe.is_deleted = 0
       LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE up.is_deleted = 0
      ORDER BY up.id, uw.workout_order, uw.id, uwe.exercise_order`,
  );

  type Plan = {
    name: string;
    isActive: boolean;
    workouts: {
      name: string | null;
      exercises: {
        name: string | null;
        sets: unknown;
        supersetGroup: string | null;
      }[];
    }[];
  };
  const plans = new Map<number, Plan>();
  const workouts = new Map<number, Plan["workouts"][number]>();
  for (const row of rows) {
    let plan = plans.get(row.plan_id);
    if (!plan) {
      plan = {
        name: row.plan_name,
        isActive: bool(row.is_active),
        workouts: [],
      };
      plans.set(row.plan_id, plan);
    }
    if (row.workout_id === null) continue;
    let workout = workouts.get(row.workout_id);
    if (!workout) {
      workout = { name: row.workout_name, exercises: [] };
      workouts.set(row.workout_id, workout);
      plan.workouts.push(workout);
    }
    if (row.exercise_name === null && row.sets === null) continue;
    let sets: unknown = row.sets;
    try {
      sets = row.sets ? JSON.parse(row.sets) : [];
    } catch {
      // Keep the raw string rather than dropping the data.
    }
    workout.exercises.push({
      name: row.exercise_name,
      sets,
      supersetGroup: row.superset_group_id,
    });
  }
  return [...plans.values()];
};

const readCustomExercises = (db: SQLite.SQLiteDatabase) =>
  db.getAllAsync<Record<string, unknown>>(
    `SELECT name, equipment, body_part, target_muscle, secondary_muscles,
            description, tracking_type
       FROM exercises
      WHERE app_exercise_id IS NULL AND is_deleted = 0
      ORDER BY name`,
  );

// RFC 4180: quote fields containing a comma, quote or line break. Text that
// a spreadsheet would run as a formula gets a leading apostrophe. Numbers are
// left alone so negative values (assisted exercises) stay numeric.
const csvField = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (fields: unknown[]) => fields.map(csvField).join(",") + "\r\n";

const unitSuffix: Record<MeasurementRow["value_kind"], string> = {
  mass: "_kg",
  length: "_cm",
  percent: "",
};

const today = () => new Date().toISOString().slice(0, 10);

const buildJson = async (db: SQLite.SQLiteDatabase): Promise<ExportFile> => {
  const workouts: ExportedWorkout[] = [];
  for await (const page of readWorkoutPages(db)) {
    for (const { workout, sets } of page) {
      workouts.push(toExportedWorkout(workout, sets));
    }
  }
  const [measurementRows, plans, customExercises, settings] = await Promise.all(
    [
      readMeasurements(db),
      readPlans(db),
      readCustomExercises(db),
      readSettings(db),
    ],
  );

  const data = {
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? null,
    units: EXPORT_UNITS,
    workouts,
    bodyMeasurements: groupMeasurements(measurementRows),
    plans,
    customExercises,
    settings,
  };
  return {
    name: `musclequest_export_${today()}.json`,
    mimeType: "application/json",
    content: JSON.stringify(data, null, 2),
  };
};

const buildCsv = async (db: SQLite.SQLiteDatabase): Promise<ExportFile[]> => {
  let sets = csvRow([
    "date",
    "workout",
    "exercise",
    "set_number",
    "weight_kg",
    "reps",
    "time_s",
    "distance_m",
    "is_warmup",
    "is_drop_set",
    "is_to_failure",
  ]);
  for await (const page of readWorkoutPages(db)) {
    for (const { workout, sets: rows } of page) {
      for (const set of rows) {
        sets += csvRow([
          workout.date_completed,
          workout.workout_name,
          set.exercise_name,
          set.set_number,
          set.weight,
          set.reps,
          set.time,
          set.distance,
          bool(set.is_warmup),
          bool(set.is_drop_set),
          bool(set.is_to_failure),
        ]);
      }
    }
  }

  // One row per entry and one column per metric, which is what a
  // spreadsheet wants.
  const measurementRows = await readMeasurements(db);
  const columns = new Map<string, string>();
  for (const row of measurementRows) {
    if (!columns.has(row.key)) {
      columns.set(row.key, `${row.key}${unitSuffix[row.value_kind]}`);
    }
  }
  let measurements = csvRow(["date", ...columns.values()]);
  for (const entry of groupMeasurements(measurementRows)) {
    measurements += csvRow([
      entry.date,
      ...[...columns.keys()].map((key) => entry.values[key]),
    ]);
  }

  return [
    {
      name: `musclequest_workout_sets_${today()}.csv`,
      mimeType: "text/csv",
      content: sets,
    },
    {
      name: `musclequest_body_measurements_${today()}.csv`,
      mimeType: "text/csv",
      content: measurements,
    },
  ];
};

// Reads the local training data into export files. Works signed out, since
// everything comes from the device.
export const buildTrainingDataExport = async (
  format: ExportFormat,
): Promise<ExportFile[]> => {
  const db = await openDatabase("userData.db");
  try {
    return format === "json" ? [await buildJson(db)] : await buildCsv(db);
  } finally {
    await db.closeAsync();
  }
};

// Asks the user for a folder (Android's Storage Access Framework picker) and
// writes the files there. Returns false if they dismissed the picker.
export const saveExportToFolder = async (
  files: ExportFile[],
): Promise<boolean> => {
  let directory: Awaited<ReturnType<typeof Directory.pickDirectoryAsync>>;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isPickerCancelled(error)) return false;
    throw error;
  }
  // A failed export leaves nothing behind, so the folder never holds half of
  // a CSV pair or an empty file.
  const created: { delete: () => void }[] = [];
  try {
    for (const file of files) {
      const written = directory.createFile(file.name, file.mimeType);
      created.push(written);
      written.write(file.content);
    }
  } catch (error) {
    for (const file of created) {
      try {
        file.delete();
      } catch {
        // Best effort; the original error is what matters.
      }
    }
    throw error;
  }
  return true;
};

const isPickerCancelled = (error: unknown) =>
  /cancel/i.test(
    `${(error as { code?: string }).code ?? ""} ${
      error instanceof Error ? error.message : ""
    }`,
  );

export const exportTrainingData = async (
  format: ExportFormat,
): Promise<boolean> =>
  saveExportToFolder(await buildTrainingDataExport(format));
