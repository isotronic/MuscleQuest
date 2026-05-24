import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

interface WorkoutResult {
  id: number;
  plan_id: number;
  workout_id: number;
  workout_name: string | null;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercise_id: number;
  exercise_name: string;
  exercise_image: Uint8Array | null;
  exercise_tracking_type: string;
  is_unilateral: number | null;
  double_weight: number | null;
  set_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: number | null;
  set_duration: number | null;
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
    is_unilateral?: number;
    double_weight?: number;
    sets: {
      set_id: number;
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup: boolean;
      set_duration: number | null;
    }[];
  }[];
}

const QUICK_WORKOUT_FALLBACK = "Quick Workout";

const fetchCompletedWorkouts = async (
  timeRange: number,
  startDate?: string,
  endDate?: string,
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
        exercises.is_unilateral,
        exercises.double_weight,
        completed_sets.id AS set_id,
        completed_sets.set_number,
        completed_sets.weight,
        completed_sets.reps,
        completed_sets.time,
        completed_sets.distance,
        completed_sets.is_warmup,
        completed_sets.set_duration
      FROM completed_workouts
      LEFT JOIN completed_exercises ON completed_exercises.completed_workout_id = completed_workouts.id
      LEFT JOIN exercises ON exercises.exercise_id = completed_exercises.exercise_id -- Fetch exercise details from exercises table
      LEFT JOIN completed_sets ON completed_sets.completed_exercise_id = completed_exercises.id
      LEFT JOIN user_workouts ON user_workouts.id = completed_workouts.workout_id
    `;

    const params: (string | number)[] = [];
    query += ` WHERE completed_workouts.is_deleted = FALSE`;
    if (startDate && endDate) {
      query += ` AND date_completed BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (timeRange > 0) {
      query += ` AND date_completed >= date('now', '-${timeRange} days')`;
    }

    query += `
      ORDER BY completed_workouts.date_completed DESC, completed_exercises.id, completed_sets.set_number;
    `;

    const results = await db.getAllAsync(query, params);

    return results as WorkoutResult[];
  } catch (error: any) {
    console.error("Error fetching completed workouts:", error);
    Bugsnag.notify(error);
    throw new Error("Failed to fetch completed workouts");
  }
};

const fetchAndOrganize = async (
  weightUnit: string,
  distanceUnit: string,
  timeRange: number,
  startDate?: string,
  endDate?: string,
): Promise<CompletedWorkout[]> => {
  const results = await fetchCompletedWorkouts(timeRange, startDate, endDate);

  if (results) {
    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;
    const distanceConversionFactor = distanceUnit === "ft" ? 3.28084 : 1;

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
        is_unilateral,
        double_weight,
        set_id,
        set_number,
        weight,
        reps,
        time,
        distance,
      } = item;

      let workout = workoutsMap.get(id);

      // If the workout doesn't exist, create and add it to the map and array
      if (!workout) {
        workout = {
          id,
          workout_id,
          plan_id,
          workout_name: workout_name ?? QUICK_WORKOUT_FALLBACK,
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
          is_unilateral: is_unilateral ?? 0,
          double_weight: double_weight ?? 0,
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
        distance:
          distance != null
            ? parseFloat((distance * distanceConversionFactor).toFixed(2))
            : null,
        is_warmup: !!item.is_warmup,
        set_duration: item.set_duration ?? null,
      });
    });

    // Return the array of workouts in the correct order
    return workoutsArray;
  }

  return []; // Return an empty array if results is undefined
};

export const useCompletedWorkoutsQuery = (
  weightUnit: string,
  distanceUnit: string = "m",
  timeRange = 0,
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["completedWorkouts", weightUnit, distanceUnit, timeRange],
    queryFn: () => fetchAndOrganize(weightUnit, distanceUnit, timeRange),
    staleTime: 0,
    gcTime: 0,
  });
};

const getPreviousPeriodDates = (
  days: number,
): { startDate: string; endDate: string } => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - days - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
};

export const usePreviousPeriodWorkoutsQuery = (
  weightUnit: string,
  distanceUnit: string = "m",
  timeRange: number,
) => {
  const enabled = timeRange > 0;
  const { startDate, endDate } = enabled
    ? getPreviousPeriodDates(timeRange)
    : { startDate: "", endDate: "" };

  return useQuery<CompletedWorkout[]>({
    queryKey: [
      "completedWorkouts",
      weightUnit,
      distanceUnit,
      timeRange,
      "prev",
    ],
    queryFn: () =>
      fetchAndOrganize(weightUnit, distanceUnit, timeRange, startDate, endDate),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
};

const fetchWorkoutHistoryForSession = async (
  workoutId: number,
  weightUnit: string,
  distanceUnit: string,
): Promise<CompletedWorkout[]> => {
  try {
    const db = await openDatabase("userData.db");
    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;
    const distanceConversionFactor = distanceUnit === "ft" ? 3.28084 : 1;

    const query = `
      SELECT
        cw.id,
        cw.plan_id,
        cw.workout_id,
        uw.name AS workout_name,
        cw.date_completed,
        cw.duration,
        cw.total_sets_completed,
        ce.exercise_id,
        e.name AS exercise_name,
        e.tracking_type AS exercise_tracking_type,
        e.is_unilateral,
        e.double_weight,
        cs.id AS set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration
      FROM (
        SELECT * FROM completed_workouts
        WHERE workout_id = ? AND is_deleted = FALSE
        ORDER BY date_completed DESC
        LIMIT 10
      ) AS cw
      LEFT JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
      LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      ORDER BY cw.date_completed DESC, ce.id, cs.set_number
    `;

    const results = (await db.getAllAsync(query, [
      workoutId,
    ])) as WorkoutResult[];

    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

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
        exercise_tracking_type,
        set_id,
        set_number,
        weight,
        reps,
        time,
        distance,
        is_warmup,
      } = item;

      let workout = workoutsMap.get(id);
      if (!workout) {
        workout = {
          id,
          workout_id,
          plan_id,
          workout_name: workout_name ?? QUICK_WORKOUT_FALLBACK,
          date_completed,
          duration,
          total_sets_completed,
          exercises: [],
        };
        workoutsMap.set(id, workout);
        workoutsArray.push(workout);
      }

      let exercise = workout.exercises.find(
        (ex) => ex.exercise_id === exercise_id,
      );
      if (!exercise) {
        exercise = {
          exercise_id,
          exercise_name,
          exercise_tracking_type,
          is_unilateral: item.is_unilateral ?? 0,
          double_weight: item.double_weight ?? 0,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      exercise.sets.push({
        set_id,
        set_number,
        weight:
          weight != null
            ? parseFloat((weight * conversionFactor).toFixed(1))
            : null,
        reps,
        time,
        distance:
          distance != null
            ? parseFloat((distance * distanceConversionFactor).toFixed(2))
            : null,
        is_warmup: !!is_warmup,
        set_duration: item.set_duration ?? null,
      });
    });

    return workoutsArray;
  } catch (error: any) {
    console.error("Error fetching workout session history:", error);
    Bugsnag.notify(error);
    throw new Error("Failed to fetch workout session history");
  }
};

export const useWorkoutSessionHistoryQuery = (
  workoutId: number,
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["workoutSessionHistory", workoutId, weightUnit, distanceUnit],
    queryFn: () =>
      fetchWorkoutHistoryForSession(workoutId, weightUnit, distanceUnit),
    enabled: workoutId > 0,
    staleTime: 5 * 60 * 1000,
  });
};

const fetchGlobalExerciseHistoryForSession = async (
  weightUnit: string,
  distanceUnit: string,
): Promise<CompletedWorkout[]> => {
  try {
    const db = await openDatabase("userData.db");
    const conversionFactor = weightUnit === "lbs" ? 2.2046226 : 1;
    const distanceConversionFactor = distanceUnit === "ft" ? 3.28084 : 1;

    const query = `
      SELECT
        cw.id,
        cw.plan_id,
        cw.workout_id,
        uw.name AS workout_name,
        cw.date_completed,
        cw.duration,
        cw.total_sets_completed,
        ce.exercise_id,
        e.name AS exercise_name,
        e.tracking_type AS exercise_tracking_type,
        e.is_unilateral,
        e.double_weight,
        cs.id AS set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration
      FROM (
        SELECT * FROM completed_workouts
        WHERE is_deleted = FALSE
        ORDER BY date_completed DESC
        LIMIT 10
      ) AS cw
      LEFT JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
      LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id
      LEFT JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      ORDER BY cw.date_completed DESC, ce.id, cs.set_number
    `;

    const results = (await db.getAllAsync(query, [])) as WorkoutResult[];

    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

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
        exercise_tracking_type,
        set_id,
        set_number,
        weight,
        reps,
        time,
        distance,
        is_warmup,
      } = item;

      let workout = workoutsMap.get(id);
      if (!workout) {
        workout = {
          id,
          workout_id,
          plan_id,
          workout_name: workout_name ?? QUICK_WORKOUT_FALLBACK,
          date_completed,
          duration,
          total_sets_completed,
          exercises: [],
        };
        workoutsMap.set(id, workout);
        workoutsArray.push(workout);
      }

      let exercise = workout.exercises.find(
        (ex) => ex.exercise_id === exercise_id,
      );
      if (!exercise) {
        exercise = {
          exercise_id,
          exercise_name,
          exercise_tracking_type,
          is_unilateral: item.is_unilateral ?? 0,
          double_weight: item.double_weight ?? 0,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      exercise.sets.push({
        set_id,
        set_number,
        weight:
          weight != null
            ? parseFloat((weight * conversionFactor).toFixed(1))
            : null,
        reps,
        time,
        distance:
          distance != null
            ? parseFloat((distance * distanceConversionFactor).toFixed(2))
            : null,
        is_warmup: !!is_warmup,
        set_duration: item.set_duration ?? null,
      });
    });

    return workoutsArray;
  } catch (error: any) {
    console.error("Error fetching global exercise history:", error);
    Bugsnag.notify(error);
    throw new Error("Failed to fetch global exercise history");
  }
};

export const useGlobalExerciseHistoryForSessionQuery = (
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: ["globalExerciseHistoryForSession", weightUnit, distanceUnit],
    queryFn: () =>
      fetchGlobalExerciseHistoryForSession(weightUnit, distanceUnit),
    staleTime: 5 * 60 * 1000,
  });
};
