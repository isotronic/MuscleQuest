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
    exercise_image?: any;
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
    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

    results.forEach((item) => {
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

      let workout = workoutsMap.get(workout_id);

      // If the workout doesn't exist, create and add it to the map and array
      if (!workout) {
        workout = {
          workout_id,
          workout_name,
          date_completed,
          duration,
          total_sets_completed,
          exercises: [],
        };
        workoutsMap.set(workout_id, workout);
        workoutsArray.push(workout);
      }

      // Find or create the exercise entry
      let exercise = workout.exercises.find(
        (ex) => ex.exercise_id === exercise_id,
      );

      if (!exercise) {
        exercise = {
          exercise_id,
          exercise_name,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      // Add the set to the exercise
      exercise.sets.push({
        set_number,
        weight,
        reps,
      });
    });

    // Return the array of workouts in the correct order
    return workoutsArray;
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
