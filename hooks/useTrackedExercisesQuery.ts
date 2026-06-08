import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { useQuery } from "@tanstack/react-query";

interface TrackedExercise {
  id: number;
  exercise_id: number;
  date_added: string;
}

export interface CompletedSet {
  set_number: number;
  weight: number;
  reps: number;
  time: number;
  distance: number | undefined;
  date_completed: string;
  oneRepMax: number | undefined;
  progressionMetric: number;
}

export interface TrackedExerciseWithSets extends TrackedExercise {
  name: string;
  tracking_type: string | null;
  completed_sets: CompletedSet[];
  allTimePR: number;
}

const buildTrackedProgressionCase = (
  countUnilateralDouble: boolean,
  doubleWeightForPaired: boolean,
  trackingTypeExpr = "e.tracking_type",
) => {
  const wM = doubleWeightForPaired ? 2 : 1;
  const rM = countUnilateralDouble ? 2 : 1;
  return `
    CASE ${trackingTypeExpr}
      WHEN 'weight' THEN (cs.weight * CASE WHEN e.double_weight = 1 THEN ${wM} ELSE 1 END) * (1 + cs.reps / 30.0)
      WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - cs.weight) * (1 + cs.reps / 30.0)
      WHEN 'reps' THEN cs.reps * CASE WHEN e.is_unilateral = 1 THEN ${rM} ELSE 1 END
      WHEN 'time' THEN cs.time
      WHEN 'distance' THEN cs.distance
      ELSE (cs.weight * CASE WHEN e.double_weight = 1 THEN ${wM} ELSE 1 END) * (1 + cs.reps / 30.0)
    END
  `;
};

const fetchTrackedExercises = async (
  timeRange: string,
  excludeWarmup: boolean = false,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
  excludeDeload: boolean = false,
): Promise<TrackedExerciseWithSets[]> => {
  try {
    const db = await openDatabase("userData.db");
    // Determine the current effective tracking type per exercise via a correlated
    // subquery over user_workout_exercises. This avoids the per-session uwe join
    // (uwe.workout_id = cw.workout_id) which fails when an old completed workout
    // references a plan workout that was later deleted or reorganised, causing
    // uwe = NULL and the override to be silently ignored.
    const currentTypeExpr = `
      COALESCE(
        NULLIF(
          (SELECT uwe2.tracking_type_override
           FROM user_workout_exercises uwe2
           WHERE uwe2.exercise_id = te.exercise_id
             AND (uwe2.is_deleted = FALSE OR uwe2.is_deleted IS NULL)
             AND uwe2.tracking_type_override IS NOT NULL
             AND uwe2.tracking_type_override != ''
           LIMIT 1),
          ''
        ),
        e.tracking_type
      )`;

    const effectiveTrackingTypeExpr = currentTypeExpr;
    const progressionCase = buildTrackedProgressionCase(
      countUnilateralDouble,
      doubleWeightForPaired,
      effectiveTrackingTypeExpr,
    );

    // Include a session only when its historical tracking type matches the
    // current effective type. Pre-migration rows (resolved = NULL) are included
    // when no override is active, i.e. the base type equals the current type.
    const trackingTypeFilter = `
      AND (
        cw.id IS NULL
        OR (
          ce.resolved_tracking_type IS NOT NULL
          AND ce.resolved_tracking_type = ${currentTypeExpr}
        )
        OR (
          ce.resolved_tracking_type IS NULL
          AND e.tracking_type IS ${currentTypeExpr}
        )
      )`;

    let query = `
      SELECT
        te.*,
        e.name,
        ${currentTypeExpr} AS tracking_type,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        MAX(${progressionCase}) AS progression_metric
      FROM tracked_exercises te
      LEFT JOIN exercises e ON te.exercise_id = e.exercise_id
      LEFT JOIN completed_exercises ce ON te.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
    `;

    const warmupFilter = excludeWarmup
      ? ` AND (cs.is_warmup = FALSE OR cs.is_warmup IS NULL)`
      : "";
    const deloadFilter = excludeDeload
      ? ` AND (cw.is_deload = 0 OR cw.is_deload IS NULL)`
      : "";
    if (timeRange !== "0") {
      query += `WHERE (cw.date_completed > DATETIME('now', '-${timeRange} days') OR cw.date_completed IS NULL) AND (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${warmupFilter}${deloadFilter}${trackingTypeFilter} `;
    } else {
      query += `WHERE (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${warmupFilter}${deloadFilter}${trackingTypeFilter} `;
    }

    query += `
      GROUP BY te.exercise_id, DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC, progression_metric DESC
    `;

    const [trackedExercises, allTrackedRows] = await Promise.all([
      db.getAllAsync(query),
      db.getAllAsync(`
        SELECT te.*, e.name, ${currentTypeExpr} AS tracking_type
        FROM tracked_exercises te
        LEFT JOIN exercises e ON te.exercise_id = e.exercise_id
        ORDER BY te.sort_order ASC
      `),
    ]);

    // Fetch all-time PR for each tracked exercise (unfiltered by time range)
    const allTimePRQuery = `
      SELECT
        te.exercise_id,
        MAX(${progressionCase}) AS all_time_pr
      FROM tracked_exercises te
      LEFT JOIN exercises e ON te.exercise_id = e.exercise_id
      LEFT JOIN completed_exercises ce ON te.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${excludeWarmup ? " AND (cs.is_warmup = FALSE OR cs.is_warmup IS NULL)" : ""}${excludeDeload ? " AND (cw.is_deload = 0 OR cw.is_deload IS NULL)" : ""}
        AND (
          (
            ce.resolved_tracking_type IS NOT NULL
            AND ce.resolved_tracking_type = ${currentTypeExpr}
          )
          OR (
            ce.resolved_tracking_type IS NULL
            AND e.tracking_type IS ${currentTypeExpr}
          )
        )
      GROUP BY te.exercise_id
    `;
    const allTimePRRows = (await db.getAllAsync(allTimePRQuery)) as {
      exercise_id: number;
      all_time_pr: number | null;
    }[];
    const allTimePRMap: Record<number, number> = {};
    allTimePRRows.forEach((row) => {
      if (row.all_time_pr !== null) {
        allTimePRMap[row.exercise_id] = row.all_time_pr;
      }
    });

    // Seed groupedExercises with every tracked exercise so exercises whose
    // sessions all fail the tracking-type filter still appear in the list.
    const groupedExercises: Record<number, TrackedExerciseWithSets> = {};

    (allTrackedRows as any[]).forEach((row: any) => {
      groupedExercises[row.exercise_id] = {
        id: row.id,
        exercise_id: row.exercise_id,
        date_added: row.date_added,
        completed_sets: [],
        name: row.name,
        tracking_type: row.tracking_type,
        allTimePR: allTimePRMap[row.exercise_id] ?? 0,
      };
    });

    (trackedExercises as any[]).forEach((row: any) => {
      if (!groupedExercises[row.exercise_id]) {
        groupedExercises[row.exercise_id] = {
          id: row.id,
          exercise_id: row.exercise_id,
          date_added: row.date_added,
          completed_sets: [],
          name: row.name,
          tracking_type: row.tracking_type,
          allTimePR: allTimePRMap[row.exercise_id] ?? 0,
        };
      }

      if (row.progression_metric !== null) {
        groupedExercises[row.exercise_id].completed_sets.push({
          set_number: row.set_number,
          weight:
            row.tracking_type === "weight" ||
            row.tracking_type === "assisted" ||
            row.tracking_type === null
              ? row.weight
              : undefined,
          reps:
            row.tracking_type === "reps" ||
            row.tracking_type === "weight" ||
            row.tracking_type === "assisted" ||
            row.tracking_type === null
              ? row.reps
              : undefined,
          time:
            row.tracking_type === "time" ? row.progression_metric : undefined,
          distance: row.tracking_type === "distance" ? row.distance : undefined,
          date_completed: row.date_completed,
          oneRepMax:
            row.tracking_type === "weight" ||
            row.tracking_type === "assisted" ||
            row.tracking_type === null
              ? Math.round(row.progression_metric * 10) / 10
              : undefined,
          progressionMetric: row.progression_metric, // Save progression metric for the graph
        });
      }
    });

    return (allTrackedRows as any[])
      .map((row: any) => groupedExercises[row.exercise_id])
      .filter(Boolean);
  } catch (error: any) {
    console.error("Error fetching tracked exercises:", error);
    Bugsnag.notify(error);
    return [];
  }
};

export const useTrackedExercisesQuery = (
  timeRange: string,
  excludeWarmup: boolean = false,
  countUnilateralDouble: boolean = false,
  doubleWeightForPaired: boolean = false,
  excludeDeload: boolean = false,
) => {
  return useQuery<TrackedExerciseWithSets[], Error>({
    queryKey: [
      "trackedExercises",
      timeRange,
      excludeWarmup,
      countUnilateralDouble,
      doubleWeightForPaired,
      excludeDeload,
    ],
    queryFn: () =>
      fetchTrackedExercises(
        timeRange,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
        excludeDeload,
      ),
    staleTime: 0,
    gcTime: 0,
  });
};
