import { openDatabase } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

interface TrackedExercise {
  id: number;
  exercise_id: number;
  date_added: string;
}

interface CompletedSet {
  set_number: number;
  weight: number;
  reps: number;
  date_completed: string;
  oneRepMax: number;
}

export interface TrackedExerciseWithSets extends TrackedExercise {
  name: string;
  completed_sets: CompletedSet[];
}

const fetchTrackedExercises = async (): Promise<TrackedExerciseWithSets[]> => {
  try {
    const db = await openDatabase("userData.db");

    const trackedExercises = await db.getAllAsync(`
      SELECT 
        te.*,
        uwe.name, -- Fetch the name of the exercise
        MAX(cs.weight) AS max_weight, -- Get the max weight for the exercise in each workout
        cs.reps,
        cs.set_number,
        cw.date_completed
      FROM tracked_exercises te
      LEFT JOIN user_workout_exercises uwe ON te.exercise_id = uwe.exercise_id -- Join to get exercise name
      LEFT JOIN completed_exercises ce ON te.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
      WHERE cw.date_completed > DATETIME('now', '-30 days')
      GROUP BY cw.id, te.exercise_id -- Group by workout and exercise to get one max set per workout
      ORDER BY cw.date_completed DESC -- Optional: Order by the workout date if needed
    `);

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

      const { max_weight, reps } = row;

      // Calculate the one-rep-max (1RM) using the Epley formula
      const oneRepMax = Math.round(max_weight * (1 + reps / 30) * 10) / 10;

      groupedExercises[row.exercise_id].completed_sets.push({
        set_number: row.set_number,
        weight: row.max_weight, // Use the max weight from the query
        reps: row.reps,
        date_completed: row.date_completed,
        oneRepMax,
      });
    });

    return Object.values(groupedExercises);
  } catch (error) {
    console.error("Error fetching tracked exercises:", error);
    return [];
  }
};

export const useTrackedExercisesQuery = () => {
  return useQuery<TrackedExerciseWithSets[], Error>({
    queryKey: ["trackedExercises"],
    queryFn: fetchTrackedExercises,
    staleTime: Infinity,
  });
};
