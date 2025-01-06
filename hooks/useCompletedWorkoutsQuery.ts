import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

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
  exercise_tracking_type: string;
  set_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
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
    exercise_tracking_type: string;
    sets: {
      set_id: number;
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
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
        exercises.name AS exercise_name,
        exercises.image AS exercise_image,
        exercises.tracking_type AS exercise_tracking_type,
        completed_sets.id AS set_id,
        completed_sets.set_number,
        completed_sets.weight,
        completed_sets.reps,
        completed_sets.time
      FROM completed_workouts
      LEFT JOIN completed_exercises ON completed_exercises.completed_workout_id = completed_workouts.id
      LEFT JOIN exercises ON exercises.exercise_id = completed_exercises.exercise_id -- Fetch exercise details from exercises table
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
  } catch (error: any) {
    console.error("Error fetching completed workouts:", error);
    Bugsnag.notify(error);
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
        exercise_tracking_type,
        set_id,
        set_number,
        weight,
        reps,
        time,
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
          exercise_tracking_type,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      const convertedWeight = weight
        ? parseFloat((weight * conversionFactor).toFixed(1))
        : null;

      // Add the set to the exercise
      exercise.sets.push({
        set_id,
        set_number,
        weight: convertedWeight,
        reps,
        time,
      });
    });

    // Return the array of workouts in the correct order
    return workoutsArray;
  }

  return []; // Return an empty array if results is undefined
};

export const useCompletedWorkoutsQuery = (
  weightUnit: string,
  timeRange = 0,
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["completedWorkouts", weightUnit],
    queryFn: () => fetchAndOrganize(weightUnit, timeRange),
    staleTime: 5 * 60 * 1000,
  });
};
