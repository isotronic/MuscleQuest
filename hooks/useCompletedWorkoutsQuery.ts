import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";

interface WorkoutResult {
  id: number;
  plan_id: number;
  workout_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number;
  exercise_name: string;
  exercise_image: Uint8Array | null;
  set_number: number;
  weight: number;
  reps: number;
}

export interface CompletedWorkout {
  id: number;
  workout_id: number;
  plan_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercises: {
    exercise_id: number;
    exercise_name: string;
    exercise_image?: number[];
    sets: {
      set_number: number;
      weight: number;
      reps: number;
    }[];
  }[];
}

const fetchCompletedWorkouts = async (
  timeRange: number,
): Promise<WorkoutResult[]> => {
  try {
    const db = await openDatabase("userData.db");
    let query = `
      SELECT 
        completed_workouts.id,
        completed_workouts.plan_id,
        completed_workouts.workout_id,
        user_workouts.name AS workout_name,
        completed_workouts.date_completed,
        completed_workouts.duration,
        completed_workouts.total_sets_completed,
        completed_exercises.exercise_id,
        user_workout_exercises.name AS exercise_name,
        user_workout_exercises.image AS exercise_image,
        completed_sets.set_number,
        completed_sets.weight,
        completed_sets.reps
      FROM completed_workouts
      LEFT JOIN completed_exercises ON completed_exercises.completed_workout_id = completed_workouts.id
      LEFT JOIN user_workout_exercises ON user_workout_exercises.id = completed_exercises.exercise_id
      LEFT JOIN completed_sets ON completed_sets.completed_exercise_id = completed_exercises.id
      LEFT JOIN user_workouts ON user_workouts.id = completed_workouts.workout_id
    `;

    // If a time range is specified, filter by date_completed within that range
    if (timeRange > 0) {
      query += ` WHERE date_completed >= date('now', '-${timeRange} days')`;
    }

    query += `
      ORDER BY completed_workouts.date_completed DESC, completed_exercises.id, completed_sets.set_number;
    `;

    const results = await db.getAllAsync(query);

    return results as WorkoutResult[];
  } catch (error) {
    console.error("Error fetching completed workouts:", error);
    throw new Error("Failed to fetch completed workouts");
  }
};

const fetchAndOrganize = async (
  weightUnit: string,
  timeRange: number,
): Promise<CompletedWorkout[]> => {
  const results = await fetchCompletedWorkouts(timeRange);

  if (results) {
    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;

    results.forEach((item) => {
      const {
        id,
        workout_id,
        plan_id,
        workout_name,
        date_completed,
        duration,
        total_sets_completed,
        exercise_id,
        exercise_name,
        exercise_image,
        set_number,
        weight,
        reps,
      } = item;

      let workout = workoutsMap.get(id);

      // If the workout doesn't exist, create and add it to the map and array
      if (!workout) {
        workout = {
          id,
          workout_id,
          plan_id,
          workout_name,
          date_completed,
          duration,
          total_sets_completed,
          exercises: [],
        };
        workoutsMap.set(id, workout);
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
          exercise_image: exercise_image
            ? Array.from(exercise_image)
            : undefined,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      const convertedWeight = parseFloat(
        (weight * conversionFactor).toFixed(1),
      );

      // Add the set to the exercise
      exercise.sets.push({
        set_number,
        weight: convertedWeight,
        reps,
      });
    });

    // Return the array of workouts in the correct order
    return workoutsArray;
  }

  return []; // Return an empty array if results is undefined
};

export const useCompletedWorkoutsQuery = (
  weightUnit: string,
  timeRange: number,
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["completedWorkouts", weightUnit],
    queryFn: () => fetchAndOrganize(weightUnit, timeRange),
    staleTime: Infinity,
  });
};
