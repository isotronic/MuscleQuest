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
  date_completed: string;
  oneRepMax: number | undefined;
  progressionMetric: number;
}

export interface TrackedExerciseWithSets extends TrackedExercise {
  name: string;
  tracking_type: string;
  completed_sets: CompletedSet[];
}

const fetchTrackedExercises = async (
  timeRange: string,
): Promise<TrackedExerciseWithSets[]> => {
  try {
    const db = await openDatabase("userData.db");

    let query = `
      SELECT 
        te.*,
        e.name,
        e.tracking_type, -- Include tracking type
        cs.weight,
        cs.reps,
        cs.time,
        cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        MAX(
        CASE e.tracking_type
          WHEN 'weight' THEN cs.weight * (1 + cs.reps / 30.0)
          WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - cs.weight) * (1 + cs.reps / 30.0)
          WHEN 'reps' THEN cs.reps
          WHEN 'time' THEN cs.time
          ELSE cs.weight * (1 + cs.reps / 30.0)
        END
      ) AS progression_metric
      FROM tracked_exercises te
      LEFT JOIN exercises e ON te.exercise_id = e.exercise_id
      LEFT JOIN completed_exercises ce ON te.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
    `;

    if (timeRange !== "0") {
      query += `WHERE (cw.date_completed > DATETIME('now', '-${timeRange} days') OR cw.date_completed IS NULL) `;
    }

    query += `
      GROUP BY te.exercise_id, DATE(cw.date_completed)
      ORDER BY cw.date_completed DESC, progression_metric DESC
    `;

    const trackedExercises = await db.getAllAsync(query);

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
          time: row.tracking_type === "time" ? row.time : undefined,
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

export const useTrackedExercisesQuery = (timeRange: string) => {
  return useQuery<TrackedExerciseWithSets[], Error>({
    queryKey: ["trackedExercises"],
    queryFn: () => fetchTrackedExercises(timeRange),
    staleTime: 5 * 60 * 1000,
  });
};
