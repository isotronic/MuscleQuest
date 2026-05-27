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
) => {
  const wM = doubleWeightForPaired ? 2 : 1;
  const rM = countUnilateralDouble ? 2 : 1;
  return `
    CASE e.tracking_type
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
): Promise<TrackedExerciseWithSets[]> => {
  try {
    const db = await openDatabase("userData.db");
    const progressionCase = buildTrackedProgressionCase(
      countUnilateralDouble,
      doubleWeightForPaired,
    );

    let query = `
      SELECT
        te.*,
        e.name,
        e.tracking_type,
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
    if (timeRange !== "0") {
      query += `WHERE (cw.date_completed > DATETIME('now', '-${timeRange} days') OR cw.date_completed IS NULL) AND (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${warmupFilter} `;
    } else {
      query += `WHERE (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${warmupFilter} `;
    }

    query += `
      GROUP BY te.exercise_id, DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC, progression_metric DESC
    `;

    const trackedExercises = await db.getAllAsync(query);

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
      WHERE (cw.is_deleted = FALSE OR cw.is_deleted IS NULL)${excludeWarmup ? " AND (cs.is_warmup = FALSE OR cs.is_warmup IS NULL)" : ""}
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

    // Group the sets by the exercise
    const groupedExercises: Record<number, TrackedExerciseWithSets> = {};

    trackedExercises.forEach((row: any) => {
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

    return Object.values(groupedExercises);
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
) => {
  return useQuery<TrackedExerciseWithSets[], Error>({
    queryKey: [
      "trackedExercises",
      timeRange,
      excludeWarmup,
      countUnilateralDouble,
      doubleWeightForPaired,
    ],
    queryFn: () =>
      fetchTrackedExercises(
        timeRange,
        excludeWarmup,
        countUnilateralDouble,
        doubleWeightForPaired,
      ),
    staleTime: 0,
    gcTime: 0,
  });
};
