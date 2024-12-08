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
  oneRepMax: number;
}

export interface TrackedExerciseWithSets extends TrackedExercise {
  name: string;
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
        cs.weight,
        cs.reps,
        cs.time,
        cs.set_number,
        DATE(cw.date_completed) AS date_completed,
        MAX(cs.weight * (1 + cs.reps / 30.0)) AS max_one_rep_max -- Calculate 1RM using Epley formula
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
      GROUP BY te.exercise_id, DATE(cw.date_completed), cs.set_number
      ORDER BY cw.date_completed DESC, max_one_rep_max DESC
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
        };
      }

      if (row.max_one_rep_max !== null) {
        groupedExercises[row.exercise_id].completed_sets.push({
          set_number: row.set_number,
          weight: row.weight,
          reps: row.reps,
          time: row.time,
          date_completed: row.date_completed,
          oneRepMax: Math.round(row.max_one_rep_max * 10) / 10, // Round to 1 decimal place
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
    staleTime: Infinity,
  });
};
