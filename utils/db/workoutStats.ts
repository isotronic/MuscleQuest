// Aggregates over completed workouts, computed in SQL so the stats screens do
// not have to load every logged set into JS.
import { openDatabase } from "./connection";

/** Inclusive local_date keys ("YYYY-MM-DD"). Either end may be left open. */
export interface LocalDateRange {
  from?: string;
  to?: string;
}

export interface WorkoutStatsOptions {
  excludeWarmup: boolean;
  countUnilateralDouble: boolean;
  doubleWeightForPaired: boolean;
}

/** One completed workout with its sets already totalled. */
export interface WorkoutSummary {
  id: number;
  workout_id: number | null;
  plan_id: number | null;
  workout_name: string;
  /** The UTC instant the workout finished. Parse with parseDbTimestamp. */
  date_completed: string;
  /** The device-local calendar day it counts towards, "YYYY-MM-DD". */
  local_date: string;
  duration: number;
  total_sets_completed: number;
  is_deload: number;
  /** Logged sets, without warm-ups when the query excluded them. */
  set_count: number;
  /** Weight x reps over the counted sets, in kg. */
  volume_kg: number;
}

export interface BodyPartSetCount {
  body_part: string;
  set_count: number;
}

const QUICK_WORKOUT_FALLBACK = "Quick Workout";

const NOT_WARMUP = `COALESCE(cs.is_warmup, 0) = 0`;

const rangeFilter = (range: LocalDateRange) => {
  const conditions: string[] = [];
  const params: string[] = [];
  if (range.from) {
    conditions.push(`cw.local_date >= ?`);
    params.push(range.from);
  }
  if (range.to) {
    conditions.push(`cw.local_date <= ?`);
    params.push(range.to);
  }
  return {
    sql: conditions.map((condition) => ` AND ${condition}`).join(""),
    params,
  };
};

export const fetchWorkoutSummaries = async (
  range: LocalDateRange,
  options: WorkoutStatsOptions,
): Promise<WorkoutSummary[]> => {
  const weightMultiplier = options.doubleWeightForPaired
    ? `CASE WHEN e.double_weight THEN 2 ELSE 1 END`
    : `1`;
  const repMultiplier = options.countUnilateralDouble
    ? `CASE WHEN e.is_unilateral THEN 2 ELSE 1 END`
    : `1`;
  const filter = rangeFilter(range);

  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<
      Omit<WorkoutSummary, "workout_name"> & { workout_name: string | null }
    >(
      `
      SELECT
        cw.id,
        cw.workout_id,
        cw.plan_id,
        uw.name AS workout_name,
        cw.date_completed,
        cw.local_date,
        cw.duration,
        cw.total_sets_completed,
        cw.is_deload,
        COUNT(cs.id) AS set_count,
        COALESCE(SUM(
          CASE WHEN cs.weight != 0 AND cs.reps != 0
            THEN cs.weight * ${weightMultiplier} * cs.reps * ${repMultiplier}
            ELSE 0
          END
        ), 0) AS volume_kg
      FROM completed_workouts cw
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      LEFT JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
      LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON cs.completed_exercise_id = ce.id${
        options.excludeWarmup ? ` AND ${NOT_WARMUP}` : ""
      }
      WHERE cw.is_deleted = FALSE${filter.sql}
      GROUP BY cw.id
      ORDER BY cw.date_completed DESC, cw.id DESC
      `,
      filter.params,
    );
    return rows.map((row) => ({
      ...row,
      workout_name: row.workout_name ?? QUICK_WORKOUT_FALLBACK,
      duration: row.duration ?? 0,
      total_sets_completed: row.total_sets_completed ?? 0,
      is_deload: row.is_deload ?? 0,
    }));
  } finally {
    await db.closeAsync();
  }
};

// Sets per body part, for exercises that still exist. Raw body parts: the
// caller folds upper/lower arms and legs together.
export const fetchBodyPartSetCounts = async (
  range: LocalDateRange,
  excludeWarmup: boolean,
): Promise<BodyPartSetCount[]> => {
  const filter = rangeFilter(range);
  const db = await openDatabase("userData.db");
  try {
    return await db.getAllAsync<BodyPartSetCount>(
      `
      SELECT e.body_part, COUNT(cs.id) AS set_count
      FROM completed_workouts cw
      JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
      JOIN exercises e ON e.exercise_id = ce.exercise_id AND e.is_deleted = FALSE
      JOIN completed_sets cs ON cs.completed_exercise_id = ce.id${
        excludeWarmup ? ` AND ${NOT_WARMUP}` : ""
      }
      WHERE cw.is_deleted = FALSE
        AND e.body_part IS NOT NULL AND e.body_part != ''${filter.sql}
      GROUP BY e.body_part
      ORDER BY set_count DESC, e.body_part
      `,
      filter.params,
    );
  } finally {
    await db.closeAsync();
  }
};

export const fetchHasCompletedWorkout = async (): Promise<boolean> => {
  const db = await openDatabase("userData.db");
  try {
    const row = await db.getFirstAsync<{ found: number }>(
      `SELECT EXISTS(SELECT 1 FROM completed_workouts WHERE is_deleted = FALSE) AS found`,
    );
    return !!row?.found;
  } finally {
    await db.closeAsync();
  }
};

/**
 * How many workouts are in the history, optionally only those completed after
 * `since`. A COUNT, so the backup reminder never loads the history itself.
 */
export const countCompletedWorkouts = async (since?: Date): Promise<number> => {
  const db = await openDatabase("userData.db");
  try {
    const row = since
      ? await db.getFirstAsync<{ total: number }>(
          `SELECT COUNT(*) AS total FROM completed_workouts
           WHERE is_deleted = FALSE AND date_completed > ?`,
          [since.toISOString()],
        )
      : await db.getFirstAsync<{ total: number }>(
          `SELECT COUNT(*) AS total FROM completed_workouts WHERE is_deleted = FALSE`,
        );
    return row?.total ?? 0;
  } finally {
    await db.closeAsync();
  }
};
