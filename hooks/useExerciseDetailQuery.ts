import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import {
  TrackedExerciseWithSets,
  CompletedSet,
} from "./useTrackedExercisesQuery";

interface PRSet extends CompletedSet {
  date_completed: string;
}

interface RecentSession {
  date_completed: string;
  bestSet: CompletedSet;
}

export interface ExerciseDetail {
  trackedExercise: TrackedExerciseWithSets;
  allTimePR: number;
  latestMetric: number | null;
  trackingType: string | null;
  topPRSets: PRSet[];
  recentSessions: RecentSession[];
  preRangeBaseline: number | null;
}

const buildProgressionMetricCase = (
  weightM: number,
  repM: number,
  trackingTypeExpr = "e.tracking_type",
) => `
  CASE ${trackingTypeExpr}
    WHEN 'weight' THEN (cs.weight * ${weightM}) * (1 + cs.reps / 30.0)
    WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - cs.weight) * (1 + cs.reps / 30.0)
    WHEN 'reps' THEN cs.reps * ${repM}
    WHEN 'time' THEN cs.time
    WHEN 'distance' THEN cs.distance
    ELSE (cs.weight * ${weightM}) * (1 + cs.reps / 30.0)
  END
`;

const mapRowToCompletedSet = (
  row: any,
  trackingType: string | null,
): CompletedSet => {
  const isWeight =
    !trackingType || trackingType === "weight" || trackingType === "assisted";
  return {
    set_number: row.set_number,
    weight: isWeight ? row.weight : undefined,
    reps: trackingType === "reps" || isWeight ? row.reps : undefined,
    time: trackingType === "time" ? row.time : undefined,
    distance: trackingType === "distance" ? row.distance : undefined,
    date_completed: row.date_completed,
    oneRepMax: isWeight
      ? Math.round(row.progression_metric * 10) / 10
      : undefined,
    progressionMetric: row.progression_metric,
  };
};

const fetchExerciseDetail = async (
  exerciseId: number,
  timeRange: string,
  excludeWarmup = false,
  countUnilateralDouble = false,
  doubleWeightForPaired = false,
): Promise<ExerciseDetail | null> => {
  try {
    const db = await openDatabase("userData.db");
    const warmupFilter = excludeWarmup
      ? " AND (cs.is_warmup = FALSE OR cs.is_warmup IS NULL)"
      : "";

    const exerciseFlags = await db.getFirstAsync<{
      is_unilateral: number;
      double_weight: number;
    }>(
      "SELECT is_unilateral, double_weight FROM exercises WHERE exercise_id = ?",
      [exerciseId],
    );
    const repM = countUnilateralDouble && exerciseFlags?.is_unilateral ? 2 : 1;
    const weightM =
      doubleWeightForPaired && exerciseFlags?.double_weight ? 2 : 1;
    const effectiveTrackingTypeExpr =
      "COALESCE(NULLIF(ce.resolved_tracking_type, ''), NULLIF(uwe.tracking_type_override, ''), e.tracking_type)";
    const progressionMetricCase = buildProgressionMetricCase(
      weightM,
      repM,
      effectiveTrackingTypeExpr,
    );

    // Fetch the best set per day for this exercise (time-range filtered).
    // ROW_NUMBER() deterministically picks the highest-metric set per date,
    // ensuring cs.weight/reps/time correspond to the actual best set.
    let setsQuery = `
      WITH best_sets AS (
        SELECT
          COALESCE(NULLIF(ce.resolved_tracking_type, ''), NULLIF(uwe.tracking_type_override, ''), e.tracking_type) AS tracking_type,
          cs.weight,
          cs.reps,
          cs.time,
          cs.distance,
          cs.set_number,
          DATE(cw.date_completed) AS date_completed,
          (${progressionMetricCase}) AS progression_metric,
          ROW_NUMBER() OVER (
            PARTITION BY DATE(cw.date_completed)
            ORDER BY (${progressionMetricCase}) DESC
          ) AS rn
        FROM exercises e
        LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
        LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
        LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
        LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id
          AND uwe.exercise_id = e.exercise_id
          AND (uwe.is_deleted = FALSE OR uwe.is_deleted IS NULL)
        WHERE e.exercise_id = ? AND cw.is_deleted = FALSE${warmupFilter}
    `;

    if (timeRange !== "0") {
      setsQuery += ` AND cw.date_completed > DATETIME('now', '-${timeRange} days')`;
    }

    setsQuery += `
      )
      SELECT tracking_type, weight, reps, time, distance, set_number, date_completed, progression_metric
      FROM best_sets
      WHERE rn = 1
      ORDER BY date_completed DESC
    `;

    const setsRows = (await db.getAllAsync(setsQuery, [exerciseId])) as any[];

    if (setsRows.length === 0) return null;

    const trackingType: string | null = setsRows[0]?.tracking_type ?? null;

    const completedSets: CompletedSet[] = setsRows
      .filter((r) => r.progression_metric !== null)
      .map((r) => mapRowToCompletedSet(r, r.tracking_type ?? null));

    // Fetch all-time PR
    const allTimePRQuery = `
      SELECT MAX(${progressionMetricCase}) AS all_time_pr
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id
        AND uwe.exercise_id = e.exercise_id
        AND (uwe.is_deleted = FALSE OR uwe.is_deleted IS NULL)
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE${warmupFilter}
    `;
    const prRow = (await db.getFirstAsync(allTimePRQuery, [exerciseId])) as {
      all_time_pr: number | null;
    } | null;
    const allTimePR = prRow?.all_time_pr ?? 0;

    // Build TrackedExerciseWithSets shape for ExerciseProgressionChart
    const exerciseNameRow = (await db.getFirstAsync(
      `SELECT name FROM exercises WHERE exercise_id = ?`,
      [exerciseId],
    )) as { name: string } | null;

    const trackedExercise: TrackedExerciseWithSets = {
      id: exerciseId,
      exercise_id: exerciseId,
      date_added: "",
      name: exerciseNameRow?.name ?? "",
      tracking_type: trackingType,
      completed_sets: completedSets,
      allTimePR,
    };

    // Top 5 PR sets (highest progressionMetric, all time)
    const topPRQuery = `
      SELECT
        cs.weight, cs.reps, cs.time, cs.distance, cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        ${progressionMetricCase} AS progression_metric,
        COALESCE(uwe.tracking_type_override, e.tracking_type) AS tracking_type
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id
        AND uwe.exercise_id = e.exercise_id
        AND (uwe.is_deleted = FALSE OR uwe.is_deleted IS NULL)
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE${warmupFilter}
      ORDER BY progression_metric DESC
      LIMIT 5
    `;
    const topPRRows = (await db.getAllAsync(topPRQuery, [exerciseId])) as any[];
    const topPRSets: PRSet[] = topPRRows.map((r) => ({
      ...mapRowToCompletedSet(r, r.tracking_type ?? null),
      date_completed: r.date_completed,
    }));

    // Recent 5 sessions (distinct workout days)
    const recentQuery = `
      SELECT
        DATE(cw.date_completed) AS date_completed,
        cs.weight, cs.reps, cs.time, cs.distance, cs.set_number,
        MAX(${progressionMetricCase}) AS progression_metric,
        COALESCE(uwe.tracking_type_override, e.tracking_type) AS tracking_type
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id
        AND uwe.exercise_id = e.exercise_id
        AND (uwe.is_deleted = FALSE OR uwe.is_deleted IS NULL)
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE${warmupFilter}
      GROUP BY DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC
      LIMIT 5
    `;
    const recentRows = (await db.getAllAsync(recentQuery, [
      exerciseId,
    ])) as any[];
    const recentSessions: RecentSession[] = recentRows.map((r) => ({
      date_completed: r.date_completed,
      bestSet: mapRowToCompletedSet(r, r.tracking_type ?? null),
    }));

    const latestMetric =
      completedSets.length > 0 ? completedSets[0].progressionMetric : null;

    // Most recent best set from before the selected time range (used as chart baseline)
    let preRangeBaseline: number | null = null;
    if (timeRange !== "0") {
      const baselineQuery = `
        SELECT MAX(${progressionMetricCase}) AS baseline_metric
        FROM exercises e
        JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
        JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
        JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
        LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id
          AND uwe.exercise_id = e.exercise_id
          AND (uwe.is_deleted = FALSE OR uwe.is_deleted IS NULL)
        WHERE e.exercise_id = ?
          AND cw.is_deleted = FALSE${warmupFilter}
          AND DATE(cw.date_completed) < DATE('now', '-${timeRange} days')
        GROUP BY DATE(cw.date_completed)
        ORDER BY DATE(cw.date_completed) DESC
        LIMIT 1
      `;
      const baselineRow = (await db.getFirstAsync(baselineQuery, [
        exerciseId,
      ])) as {
        baseline_metric: number | null;
      } | null;
      preRangeBaseline = baselineRow?.baseline_metric ?? null;
    }

    return {
      trackedExercise,
      allTimePR,
      latestMetric,
      trackingType,
      topPRSets,
      recentSessions,
      preRangeBaseline,
    };
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error fetching exercise detail:", error);
    throw error;
  }
};

export const useExerciseDetailQuery = (
  exerciseId: number,
  timeRange: string,
  weightUnit: string,
  excludeWarmup = false,
  countUnilateralDouble = false,
  doubleWeightForPaired = false,
) => {
  return useQuery<ExerciseDetail | null>({
    queryKey: [
      "exerciseDetail",
      exerciseId,
      timeRange,
      weightUnit,
      excludeWarmup,
      countUnilateralDouble,
      doubleWeightForPaired,
    ],
    queryFn: () =>
      fetchExerciseDetail(
        exerciseId,
        timeRange,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      ),
    enabled: exerciseId > 0,
    staleTime: 0,
    gcTime: 0,
  });
};
