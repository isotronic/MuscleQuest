import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";
import { TrackedExerciseWithSets, CompletedSet } from "./useTrackedExercisesQuery";

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
}

const progressionMetricCase = `
  CASE e.tracking_type
    WHEN 'weight' THEN cs.weight * (1 + cs.reps / 30.0)
    WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - cs.weight) * (1 + cs.reps / 30.0)
    WHEN 'reps' THEN cs.reps
    WHEN 'time' THEN cs.time
    ELSE cs.weight * (1 + cs.reps / 30.0)
  END
`;

const mapRowToCompletedSet = (row: any, trackingType: string | null): CompletedSet => {
  const isWeight = !trackingType || trackingType === "weight" || trackingType === "assisted";
  return {
    set_number: row.set_number,
    weight: isWeight ? row.weight : undefined,
    reps: trackingType === "reps" || isWeight ? row.reps : undefined,
    time: trackingType === "time" ? row.time : undefined,
    date_completed: row.date_completed,
    oneRepMax: isWeight ? Math.round(row.progression_metric * 10) / 10 : undefined,
    progressionMetric: row.progression_metric,
  };
};

const fetchExerciseDetail = async (
  exerciseId: number,
  timeRange: string,
  weightUnit: string,
): Promise<ExerciseDetail | null> => {
  try {
    const db = await openDatabase("userData.db");
    const convFactor = weightUnit === "lbs" ? 2.2046226 : 1;

    // Fetch all sets for this exercise (time-range filtered)
    let setsQuery = `
      SELECT
        e.tracking_type,
        cs.weight,
        cs.reps,
        cs.time,
        cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        MAX(${progressionMetricCase}) AS progression_metric
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE
    `;

    if (timeRange !== "0") {
      setsQuery += ` AND cw.date_completed > DATETIME('now', '-${timeRange} days')`;
    }

    setsQuery += `
      GROUP BY DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC
    `;

    const setsRows = (await db.getAllAsync(setsQuery, [exerciseId])) as any[];

    if (setsRows.length === 0) return null;

    const trackingType: string | null = setsRows[0]?.tracking_type ?? null;

    const completedSets: CompletedSet[] = setsRows
      .filter((r) => r.progression_metric !== null)
      .map((r) => mapRowToCompletedSet(r, trackingType));

    // Fetch all-time PR
    const allTimePRQuery = `
      SELECT MAX(${progressionMetricCase}) AS all_time_pr
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE
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
      tracking_type: trackingType ?? "",
      completed_sets: completedSets,
      allTimePR,
    };

    // Top 5 PR sets (highest progressionMetric, all time)
    const topPRQuery = `
      SELECT
        cs.weight, cs.reps, cs.time, cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        ${progressionMetricCase} AS progression_metric
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE
      ORDER BY progression_metric DESC
      LIMIT 5
    `;
    const topPRRows = (await db.getAllAsync(topPRQuery, [exerciseId])) as any[];
    const topPRSets: PRSet[] = topPRRows.map((r) => ({
      ...mapRowToCompletedSet(r, trackingType),
      date_completed: r.date_completed,
    }));

    // Recent 5 sessions (distinct workout days)
    const recentQuery = `
      SELECT
        DATE(cw.date_completed) AS date_completed,
        cs.weight, cs.reps, cs.time, cs.set_number,
        MAX(${progressionMetricCase}) AS progression_metric
      FROM exercises e
      LEFT JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE e.exercise_id = ? AND cw.is_deleted = FALSE
      GROUP BY DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC
      LIMIT 5
    `;
    const recentRows = (await db.getAllAsync(recentQuery, [exerciseId])) as any[];
    const recentSessions: RecentSession[] = recentRows.map((r) => ({
      date_completed: r.date_completed,
      bestSet: mapRowToCompletedSet(r, trackingType),
    }));

    const latestMetric =
      completedSets.length > 0 ? completedSets[0].progressionMetric : null;

    return {
      trackedExercise,
      allTimePR,
      latestMetric,
      trackingType,
      topPRSets,
      recentSessions,
    };
  } catch (error: any) {
    Bugsnag.notify(error);
    console.error("Error fetching exercise detail:", error);
    return null;
  }
};

export const useExerciseDetailQuery = (
  exerciseId: number,
  timeRange: string,
  weightUnit: string,
) => {
  return useQuery<ExerciseDetail | null>({
    queryKey: ["exerciseDetail", exerciseId, timeRange, weightUnit],
    queryFn: () => fetchExerciseDetail(exerciseId, timeRange, weightUnit),
    enabled: exerciseId > 0,
    staleTime: 5 * 60 * 1000,
  });
};
