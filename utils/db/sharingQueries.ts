import { Exercise } from "./exercises";
import { openDatabase } from "./connection";

export const fetchAllCustomExercisesForSharing = async (): Promise<
  Exercise[]
> => {
  const db = await openDatabase("userData.db");
  try {
    return await db.getAllAsync<Exercise>(
      `SELECT * FROM exercises WHERE app_exercise_id IS NULL AND is_deleted = FALSE`,
    );
  } finally {
    await db.closeAsync();
  }
};

interface RawPlanRow {
  id: number;
  name: string;
  image_url: string | null;
  is_active: number;
  app_plan_id: number | null;
}

interface RawPlanWorkoutRow {
  workout_id: number;
  workout_name: string;
  workout_order: number;
  exercise_id: number | null;
  app_exercise_id: number | null;
  exercise_name: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  is_unilateral: number;
  double_weight: number;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number;
  superset_group_id: string | null;
}

export const fetchFullPlanForSharing = async (
  planId: number,
): Promise<{
  plan: RawPlanRow;
  workouts: {
    workout_id: number;
    workout_name: string;
    workout_order: number;
    exercises: RawPlanWorkoutRow[];
  }[];
} | null> => {
  const db = await openDatabase("userData.db");
  try {
    const plan = await db.getFirstAsync<RawPlanRow>(
      `SELECT id, name, image_url, is_active, app_plan_id FROM user_plans WHERE id = ? AND is_deleted = FALSE`,
      [planId],
    );
    if (!plan) return null;

    const rows = await db.getAllAsync<RawPlanWorkoutRow>(
      `SELECT
       uw.id AS workout_id, uw.name AS workout_name, uw.workout_order,
       e.exercise_id, e.app_exercise_id, e.name AS exercise_name,
       e.animated_url, e.equipment, e.body_part, e.target_muscle,
       e.secondary_muscles, e.tracking_type, e.is_unilateral, e.double_weight,
       uwe.tracking_type_override, uwe.sets, uwe.exercise_order,
       uwe.superset_group_id
     FROM user_workouts uw
     LEFT JOIN user_workout_exercises uwe
       ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
     LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
     WHERE uw.plan_id = ? AND uw.is_deleted = FALSE
     ORDER BY uw.workout_order, uwe.exercise_order`,
      [planId],
    );

    const workoutsMap = new Map<
      number,
      {
        workout_id: number;
        workout_name: string;
        workout_order: number;
        exercises: RawPlanWorkoutRow[];
      }
    >();
    for (const row of rows) {
      if (!workoutsMap.has(row.workout_id)) {
        workoutsMap.set(row.workout_id, {
          workout_id: row.workout_id,
          workout_name: row.workout_name,
          workout_order: row.workout_order,
          exercises: [],
        });
      }
      if (row.exercise_id) {
        workoutsMap.get(row.workout_id)!.exercises.push(row);
      }
    }

    return { plan, workouts: Array.from(workoutsMap.values()) };
  } finally {
    await db.closeAsync();
  }
};

interface RawStandaloneWorkoutRow {
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  exercise_id: number | null;
  app_exercise_id: number | null;
  exercise_name: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  is_unilateral: number;
  double_weight: number;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number;
  superset_group_id: string | null;
}

export const fetchStandaloneWorkoutForSharing = async (
  workoutId: number,
): Promise<{
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  exercises: RawStandaloneWorkoutRow[];
} | null> => {
  const db = await openDatabase("userData.db");
  try {
    const wRow = await db.getFirstAsync<{
      id: number;
      name: string;
      image_url: string | null;
    }>(
      `SELECT id, name, image_url FROM user_workouts WHERE id = ? AND plan_id IS NULL AND is_deleted = FALSE`,
      [workoutId],
    );
    if (!wRow) return null;

    const rows = await db.getAllAsync<RawStandaloneWorkoutRow>(
      `SELECT
       uw.id AS workout_id, uw.name AS workout_name, uw.image_url,
       e.exercise_id, e.app_exercise_id, e.name AS exercise_name,
       e.animated_url, e.equipment, e.body_part, e.target_muscle,
       e.secondary_muscles, e.tracking_type, e.is_unilateral, e.double_weight,
       uwe.tracking_type_override, uwe.sets, uwe.exercise_order,
       uwe.superset_group_id
     FROM user_workouts uw
     LEFT JOIN user_workout_exercises uwe
       ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
     LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
     WHERE uw.id = ? AND uw.is_deleted = FALSE
     ORDER BY uwe.exercise_order`,
      [workoutId],
    );

    const exercises = rows.filter((r) => r.exercise_id != null);
    return {
      workout_id: wRow.id,
      workout_name: wRow.name,
      image_url: wRow.image_url,
      exercises,
    };
  } finally {
    await db.closeAsync();
  }
};

export const fetchCompletedWorkoutForSharing = async (
  completedWorkoutId: number,
): Promise<{
  id: number;
  plan_name: string | null;
  workout_name: string | null;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  is_deload: number;
  exercises: {
    completed_exercise_id: number;
    exercise_name: string;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup: number;
      is_drop_set: number;
      is_to_failure: number;
    }[];
  }[];
} | null> => {
  const db = await openDatabase("userData.db");
  try {
    const cw = await db.getFirstAsync<{
      id: number;
      plan_name: string | null;
      workout_name: string | null;
      date_completed: string;
      duration: number;
      total_sets_completed: number;
      is_deload: number;
    }>(
      `SELECT cw.id, up.name AS plan_name, uw.name AS workout_name,
            cw.date_completed, cw.duration, cw.total_sets_completed, cw.is_deload
     FROM completed_workouts cw
     LEFT JOIN user_plans up ON up.id = cw.plan_id
     LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
     WHERE cw.id = ? AND cw.is_deleted = 0`,
      [completedWorkoutId],
    );
    if (!cw) return null;

    const setRows = await db.getAllAsync<{
      completed_exercise_id: number;
      exercise_name: string;
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup: number;
      is_drop_set: number;
      is_to_failure: number;
    }>(
      `SELECT ce.id AS completed_exercise_id, e.name AS exercise_name,
            cs.set_number, cs.weight, cs.reps, cs.time, cs.distance,
            cs.is_warmup, cs.is_drop_set, cs.is_to_failure
     FROM completed_exercises ce
     JOIN exercises e ON e.exercise_id = ce.exercise_id
     JOIN completed_sets cs ON cs.completed_exercise_id = ce.id AND cs.is_deleted = 0
     WHERE ce.completed_workout_id = ? AND ce.is_deleted = 0
     ORDER BY ce.id, cs.set_number`,
      [completedWorkoutId],
    );

    const exMap = new Map<
      number,
      {
        completed_exercise_id: number;
        exercise_name: string;
        sets: typeof setRows;
      }
    >();
    for (const row of setRows) {
      if (!exMap.has(row.completed_exercise_id)) {
        exMap.set(row.completed_exercise_id, {
          completed_exercise_id: row.completed_exercise_id,
          exercise_name: row.exercise_name,
          sets: [],
        });
      }
      exMap.get(row.completed_exercise_id)!.sets.push(row);
    }

    return { ...cw, exercises: Array.from(exMap.values()) };
  } finally {
    await db.closeAsync();
  }
};

export const fetchBodyMeasurementEntryForSharing = async (
  entryId: number,
): Promise<{
  id: number;
  recorded_at: string;
  values: Record<string, number>;
} | null> => {
  const db = await openDatabase("userData.db");
  try {
    const entry = await db.getFirstAsync<{ id: number; recorded_at: string }>(
      `SELECT id, recorded_at FROM body_measurement_entries WHERE id = ?`,
      [entryId],
    );
    if (!entry) return null;

    const valueRows = await db.getAllAsync<{ key: string; value: number }>(
      `SELECT bmd.key, bmv.value
     FROM body_measurement_values bmv
     JOIN body_metric_definitions bmd ON bmd.id = bmv.metric_id
     WHERE bmv.entry_id = ?`,
      [entryId],
    );

    const values: Record<string, number> = {};
    for (const v of valueRows) {
      values[v.key] = v.value;
    }

    return { id: entry.id, recorded_at: entry.recorded_at, values };
  } finally {
    await db.closeAsync();
  }
};

/**
 * Every exercise logged in a completed workout, deleted rows included, so the
 * list is still available after the workout has been soft-deleted.
 */
export const fetchCompletedWorkoutExerciseIds = async (
  completedWorkoutId: number,
): Promise<number[]> => {
  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<{ exercise_id: number }>(
      `SELECT DISTINCT exercise_id FROM completed_exercises
     WHERE completed_workout_id = ?`,
      [completedWorkoutId],
    );
    return rows.map((r) => r.exercise_id);
  } finally {
    await db.closeAsync();
  }
};

/** The library id of each exercise, which names its sharedStrength doc. */
export const fetchAppExerciseIds = async (
  exerciseIds: number[],
): Promise<{ exercise_id: number; app_exercise_id: number | null }[]> => {
  if (exerciseIds.length === 0) return [];
  const db = await openDatabase("userData.db");
  try {
    const placeholders = exerciseIds.map(() => "?").join(", ");
    return await db.getAllAsync<{
      exercise_id: number;
      app_exercise_id: number | null;
    }>(
      `SELECT exercise_id, app_exercise_id FROM exercises
     WHERE exercise_id IN (${placeholders})`,
      exerciseIds,
    );
  } finally {
    await db.closeAsync();
  }
};
