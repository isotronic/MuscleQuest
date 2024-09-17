import { useQuery } from "@tanstack/react-query";
import { fetchCompletedWorkouts } from "@/utils/database";

interface WorkoutResult {
  plan_id: number;
  workout_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  weight: number;
  reps: number;
}

export interface CompletedWorkout {
  workout_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercises: {
    exercise_id: number;
    exercise_name: string;
    sets: {
      set_number: number;
      weight: number;
      reps: number;
    }[];
  }[];
}

const fetchAndOrganize = async (): Promise<CompletedWorkout[]> => {
  const results = (await fetchCompletedWorkouts()) as
    | WorkoutResult[]
    | undefined;

  if (results) {
    const workouts = results.reduce<Record<number, CompletedWorkout>>(
      (acc, item) => {
        const {
          workout_id,
          workout_name,
          date_completed,
          duration,
          total_sets_completed,
          exercise_id,
          exercise_name,
          set_number,
          weight,
          reps,
        } = item;

        // Find or create the workout entry
        if (!acc[workout_id]) {
          acc[workout_id] = {
            workout_id,
            workout_name,
            date_completed,
            duration,
            total_sets_completed,
            exercises: [],
          };
        }

        // Find or create the exercise entry
        const exerciseIndex = acc[workout_id].exercises.findIndex(
          (ex) => ex.exercise_id === exercise_id,
        );

        if (exerciseIndex === -1) {
          acc[workout_id].exercises.push({
            exercise_id,
            exercise_name,
            sets: [],
          });
        }

        // Add the set to the exercise
        const exercise = acc[workout_id].exercises.find(
          (ex) => ex.exercise_id === exercise_id,
        );

        exercise?.sets.push({
          set_number,
          weight,
          reps,
        });

        return acc;
      },
      {},
    );

    // Convert to array format
    return Object.values(workouts);
  }

  return []; // Return an empty array if results is undefined
};

export const useCompletedWorkoutsQuery = () => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["completedWorkouts"],
    queryFn: fetchAndOrganize,
    staleTime: Infinity,
  });
};
