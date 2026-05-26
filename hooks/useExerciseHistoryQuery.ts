import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

export interface HistorySet {
  id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  /** Historical body weight in kg at the time of this set, for assisted resist calculation. */
  hist_bw_kg: number | null;
  is_warmup: boolean;
  is_pr: boolean;
}

export interface HistorySection {
  date: string;
  workout_name: string | null;
  data: HistorySet[];
}

/** Flat set shape compatible with ExerciseProgressionChart (same as CompletedSet). */
export interface ChartSet {
  set_number: number;
  weight: number;
  reps: number;
  time: number;
  distance: number | undefined;
  date_completed: string;
  oneRepMax: number | undefined;
  progressionMetric: number;
}

export interface ExerciseHistory {
  sections: HistorySection[];
  trackingType: string | null;
  /** Non-warmup sets ordered newest-first, for ExerciseProgressionChart. */
  chartSets: ChartSet[];
}

const fetchExerciseHistory = async (
  exerciseId: number,
): Promise<ExerciseHistory> => {
  const db = await openDatabase("userData.db");

  // Two-level CTE:
  // 1. sets_with_bw — joins sets/workouts and looks up the closest historical
  //    body weight (on or before the workout date) from body_measurements.
  //    Falls back to the current settings value if no measurement exists yet.
  // 2. all_sets — computes the progression metric using hist_bw_kg so that
  //    the assisted PR calculation reflects the user's weight at the time.
  const rows = (await db.getAllAsync(
    `
    WITH sets_with_bw AS (
      SELECT
        cs.id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        DATE(cw.date_completed) AS date_completed,
        cw.id                   AS workout_id,
        uw.name                 AS workout_name,
        e.tracking_type,
        COALESCE(
          (SELECT bm.body_weight FROM body_measurements bm
           WHERE bm.date <= cw.date_completed
           ORDER BY bm.date DESC LIMIT 1),
          CAST((SELECT s.value FROM settings s WHERE s.key = 'bodyWeight') AS REAL)
        ) AS hist_bw_kg
      FROM exercises e
      JOIN completed_exercises ce ON e.exercise_id = ce.exercise_id
      JOIN completed_sets cs      ON ce.id = cs.completed_exercise_id
      JOIN completed_workouts cw  ON ce.completed_workout_id = cw.id
      LEFT JOIN user_workouts uw  ON cw.workout_id = uw.id
      WHERE e.exercise_id = ?
        AND cw.is_deleted = FALSE
        AND cs.is_deleted = FALSE
    ),
    all_sets AS (
      SELECT
        *,
        CASE tracking_type
          WHEN 'weight'   THEN weight * (1 + reps / 30.0)
          WHEN 'assisted' THEN (hist_bw_kg - weight) * (1 + reps / 30.0)
          WHEN 'reps'     THEN reps
          WHEN 'time'     THEN time
          WHEN 'distance' THEN distance
          ELSE weight * (1 + reps / 30.0)
        END AS progression_metric
      FROM sets_with_bw
    )
    SELECT
      id,
      set_number,
      weight,
      reps,
      time,
      distance,
      is_warmup,
      date_completed,
      workout_id,
      workout_name,
      tracking_type,
      hist_bw_kg,
      progression_metric,
      MAX(CASE WHEN is_warmup THEN NULL ELSE progression_metric END) OVER () AS all_time_pr
    FROM all_sets
    ORDER BY date_completed DESC, set_number ASC
    `,
    [exerciseId],
  )) as {
    id: number;
    set_number: number;
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    date_completed: string;
    workout_id: number;
    workout_name: string | null;
    tracking_type: string | null;
    hist_bw_kg: number | null;
    is_warmup: number | null;
    progression_metric: number | null;
    all_time_pr: number | null;
  }[];

  if (rows.length === 0) {
    return { sections: [], trackingType: null, chartSets: [] };
  }

  const trackingType = rows[0].tracking_type;
  const allTimePR = rows[0].all_time_pr;

  const sectionMap = new Map<
    string,
    { date: string; workout_name: string | null; sets: HistorySet[] }
  >();

  for (const row of rows) {
    const key = `${row.date_completed}__${row.workout_id}`;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, { date: row.date_completed, workout_name: row.workout_name, sets: [] });
    }
    const isPR =
      allTimePR !== null &&
      row.progression_metric !== null &&
      row.progression_metric >= allTimePR;
    sectionMap.get(key)!.sets.push({
      id: row.id,
      set_number: row.set_number,
      weight: row.weight,
      reps: row.reps,
      time: row.time,
      distance: row.distance,
      hist_bw_kg: row.hist_bw_kg,
      is_warmup: !!row.is_warmup,
      is_pr: isPR,
    });
  }

  const sections: HistorySection[] = Array.from(sectionMap.entries()).map(
    ([_, { date, workout_name, sets }]) => ({
      date: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      workout_name,
      data: sets,
    }),
  );

  const trackingTypeForChart = rows[0].tracking_type;
  const chartSets: ChartSet[] = rows
    .filter((r) => !r.is_warmup && r.progression_metric != null)
    .map((r) => ({
      set_number: r.set_number,
      weight: r.weight ?? 0,
      reps: r.reps ?? 0,
      time: r.time ?? 0,
      distance: r.distance ?? undefined,
      date_completed: r.date_completed,
      oneRepMax:
        trackingTypeForChart === "weight" ||
        trackingTypeForChart === "assisted" ||
        trackingTypeForChart === null
          ? Math.round(r.progression_metric! * 10) / 10
          : undefined,
      progressionMetric: r.progression_metric!,
    }));

  return { sections, trackingType, chartSets };
};

export const useExerciseHistoryQuery = (exerciseId: number) => {
  return useQuery<ExerciseHistory>({
    queryKey: ["exerciseHistory", exerciseId],
    queryFn: async () => {
      try {
        return await fetchExerciseHistory(exerciseId);
      } catch (error: any) {
        Bugsnag.notify(error);
        throw error;
      }
    },
    enabled: exerciseId > 0,
    staleTime: 5 * 60 * 1000,
  });
};
