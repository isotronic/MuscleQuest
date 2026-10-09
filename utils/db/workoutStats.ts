// Aggregates over completed workouts, computed in SQL so the stats screens do
// not have to load every logged set into JS.
import { openDatabase } from "./connection";
import { progressionMetricSql } from "./progressionMetricSql";
import { METRIC_EPSILON } from "@/utils/units";
import { QUICK_WORKOUT_NAME } from "@/constants/quickWorkout";

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
  /** Reps over the counted sets, unilateral sets doubled when set to. */
  rep_count: number;
}

export interface BodyPartSetCount {
  body_part: string;
  set_count: number;
}

const NOT_WARMUP = `COALESCE(cs.is_warmup, 0) = 0`;

const multipliers = (options: WorkoutStatsOptions) => ({
  weight: options.doubleWeightForPaired
    ? `CASE WHEN e.double_weight THEN 2 ELSE 1 END`
    : `1`,
  reps: options.countUnilateralDouble
    ? `CASE WHEN e.is_unilateral THEN 2 ELSE 1 END`
    : `1`,
});

// Weight x reps for one set, in kg, with the doubling settings applied.
const volumeSql = (options: WorkoutStatsOptions) => {
  const m = multipliers(options);
  return `CASE WHEN cs.weight != 0 AND cs.reps != 0
    THEN cs.weight * ${m.weight} * cs.reps * ${m.reps}
    ELSE 0
  END`;
};

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
  const m = multipliers(options);
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
        COALESCE(SUM(${volumeSql(options)}), 0) AS volume_kg,
        COALESCE(SUM(COALESCE(cs.reps, 0) * ${m.reps}), 0) AS rep_count
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
      workout_name: row.workout_name ?? QUICK_WORKOUT_NAME,
      duration: row.duration ?? 0,
      total_sets_completed: row.total_sets_completed ?? 0,
      is_deload: row.is_deload ?? 0,
      rep_count: row.rep_count ?? 0,
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

export type SplitGrouping = "bodyPart" | "muscle";

/** Sets and volume for one body part or muscle, as stored on the exercise. */
export interface SplitRow {
  name: string;
  sets: number;
  volume_kg: number;
  /** 1 when the muscle is a secondary muscle of the exercises counted. */
  secondary: 0 | 1;
}

/**
 * Sets and volume per body part, or per muscle. By muscle, every exercise
 * counts towards its target muscle and, in separate rows marked secondary,
 * towards each of its secondary muscles. Names are raw: the caller merges
 * them (mergeSplitRows). Deleted exercises are left out, like the body part
 * counts.
 */
export const fetchTrainingSplit = async (
  range: LocalDateRange,
  groupBy: SplitGrouping,
  options: WorkoutStatsOptions,
): Promise<SplitRow[]> => {
  const filter = rangeFilter(range);
  const perExercise = `
    SELECT e.body_part, e.target_muscle, e.secondary_muscles,
      COUNT(cs.id) AS sets,
      COALESCE(SUM(${volumeSql(options)}), 0) AS volume_kg
    FROM completed_workouts cw
    JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
    JOIN exercises e ON e.exercise_id = ce.exercise_id AND e.is_deleted = FALSE
    JOIN completed_sets cs ON cs.completed_exercise_id = ce.id${
      options.excludeWarmup ? ` AND ${NOT_WARMUP}` : ""
    }
    WHERE cw.is_deleted = FALSE${filter.sql}
    GROUP BY e.exercise_id`;
  const sql =
    groupBy === "bodyPart"
      ? `WITH per_exercise AS (${perExercise})
         SELECT body_part AS name, SUM(sets) AS sets,
           SUM(volume_kg) AS volume_kg, 0 AS secondary
         FROM per_exercise
         WHERE body_part IS NOT NULL AND body_part != ''
         GROUP BY body_part`
      : `WITH per_exercise AS (${perExercise})
         SELECT target_muscle AS name, SUM(sets) AS sets,
           SUM(volume_kg) AS volume_kg, 0 AS secondary
         FROM per_exercise
         WHERE target_muscle IS NOT NULL AND target_muscle != ''
         GROUP BY target_muscle
         UNION ALL
         SELECT j.value AS name, SUM(sets) AS sets,
           SUM(volume_kg) AS volume_kg, 1 AS secondary
         FROM per_exercise, json_each(
           CASE WHEN json_valid(secondary_muscles)
             AND json_type(secondary_muscles) = 'array'
             THEN secondary_muscles ELSE '[]' END
         ) j
         WHERE j.type = 'text' AND j.value != ''
         GROUP BY j.value`;

  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<SplitRow>(sql, filter.params);
    return rows.filter((row) => row.sets > 0);
  } finally {
    await db.closeAsync();
  }
};

/** One session in which an exercise beat its best from earlier sessions. */
export interface RecentPR {
  exercise_id: number;
  name: string;
  tracking_type: string | null;
  completed_workout_id: number;
  local_date: string;
  /** The session's best set, by the metric below. */
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  /** Estimated 1RM for weight types, else reps, seconds or metres. */
  value: number;
  previous: number;
}

/**
 * Sessions inside the range whose best set beat every earlier session of the
 * same exercise, newest first. The first session of an exercise has nothing
 * to beat and is not a PR. Sessions logged under a different tracking type
 * (an override) are compared only with each other. Warm-ups never count.
 */
export const fetchRecentPRs = async (
  range: LocalDateRange,
  options: { trackedOnly: boolean; limit: number },
): Promise<RecentPR[]> => {
  const filter = rangeFilter(range);
  const type = `COALESCE(NULLIF(ce.resolved_tracking_type, ''), e.tracking_type)`;
  const metric = progressionMetricSql(type);
  const db = await openDatabase("userData.db");
  try {
    return await db.getAllAsync<RecentPR>(
      `
      WITH sessions AS (
        SELECT
          e.exercise_id, e.name, ${type} AS tracking_type,
          cw.id AS completed_workout_id, cw.local_date, cw.date_completed,
          cs.weight, cs.reps, cs.time, cs.distance,
          MAX(${metric}) AS value
        FROM completed_workouts cw
        JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
        JOIN exercises e ON e.exercise_id = ce.exercise_id AND e.is_deleted = FALSE
        JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
          AND ${NOT_WARMUP} AND COALESCE(cs.is_deleted, 0) = 0
        WHERE cw.is_deleted = FALSE${
          options.trackedOnly
            ? ` AND e.exercise_id IN (SELECT exercise_id FROM tracked_exercises)`
            : ""
        }
        GROUP BY e.exercise_id, ${type}, cw.id
      ),
      ranked AS (
        SELECT *, MAX(value) OVER (
          PARTITION BY exercise_id, tracking_type
          ORDER BY date_completed, completed_workout_id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS previous
        FROM sessions
      )
      SELECT exercise_id, name, tracking_type, completed_workout_id,
        local_date, weight, reps, time, distance, value, previous
      -- Aliased cw so rangeFilter's cw.local_date applies to the outer rows.
      FROM ranked cw
      WHERE previous IS NOT NULL AND value > previous + ${METRIC_EPSILON}${filter.sql}
      ORDER BY date_completed DESC, completed_workout_id DESC, value DESC
      LIMIT ?
      `,
      [...filter.params, options.limit],
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
