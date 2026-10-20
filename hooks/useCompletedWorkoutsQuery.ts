import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import type { SQLiteDatabase } from "expo-sqlite";
import { markReported, notifyBugsnag } from "@/utils/bugsnagDedup";
import { toLocalDateKey } from "@/utils/dates";
import { kgToDisplay, metresToDisplay } from "@/utils/units";
import { QUICK_WORKOUT_NAME } from "@/constants/quickWorkout";
import { withDisplayExerciseName } from "@/utils/db/exerciseNames";
import {
  bodyWeightAtSql,
  WORKOUT_BODY_WEIGHT_CTE,
} from "@/utils/db/bodyWeightAtSql";

interface WorkoutResult {
  id: number;
  plan_id: number;
  workout_id: number;
  workout_name: string | null;
  is_deload: number;
  date_completed: string;
  local_date: string;
  duration: number;
  total_sets_completed: number;
  completed_exercise_id: number;
  exercise_id: number;
  user_workout_exercise_id?: number | null;
  exercise_name: string;
  app_exercise_id?: number | null;
  exercise_tracking_type: string;
  base_tracking_type?: string | null;
  body_weight_kg?: number | null;
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
  notes?: string | null;
  note?: string | null;
}

export interface CompletedWorkout {
  id: number;
  workout_id: number;
  plan_id: number;
  workout_name: string;
  /** The UTC instant the workout finished. Parse with parseDbTimestamp. */
  date_completed: string;
  /** The device-local calendar day it counts towards, "YYYY-MM-DD". */
  local_date: string;
  duration: number;
  total_sets_completed: number;
  is_deload?: number;
  /** The session note. Loaded by the by-id and session history reads only. */
  notes?: string | null;
  /** Body weight in kg when the workout was done (bodyWeightAtSql), null
   * when none was ever logged. Not loaded by the global exercise history. */
  body_weight_kg?: number | null;
  exercises: {
    completed_exercise_id: number;
    exercise_id: number;
    /** The plan row it was logged from. Session history and by-id reads. */
    user_workout_exercise_id?: number | null;
    /** Which block of its exercise that plan row is, 0 for the first.
     * fetchCompletedWorkoutById only; null when no row was recorded. */
    plan_occurrence?: number | null;
    exercise_name: string;
    /** Thumbnail bytes. Only fetchCompletedWorkoutById loads them. */
    exercise_image?: number[];
    exercise_image_uri?: string | null;
    exercise_tracking_type: string;
    /** The exercise's own type, before a per-workout override. */
    base_tracking_type?: string | null;
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
      /** Loaded by fetchCompletedWorkoutById only. */
      is_drop_set?: boolean;
      /** Loaded by fetchCompletedWorkoutById only. */
      is_to_failure?: boolean;
      set_duration: number | null;
      note?: string | null;
    }[];
  }[];
}

// How far back the home screen and weekly components look. They need this
// week and last week; the rest is slack for a streak check after a break.
export const RECENT_HISTORY_DAYS = 56;

const fetchCompletedWorkouts = async (
  timeRange: number,
  startDate?: string,
  endDate?: string,
): Promise<WorkoutResult[]> => {
  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    let query = `
      WITH ${WORKOUT_BODY_WEIGHT_CTE}
      SELECT
        completed_workouts.id,
        completed_workouts.plan_id,
        completed_workouts.workout_id,
        user_workouts.name AS workout_name,
        completed_workouts.date_completed,
        completed_workouts.local_date,
        completed_workouts.duration,
        completed_workouts.total_sets_completed,
        completed_exercises.id as completed_exercise_id,
        completed_exercises.exercise_id,
        exercises.name AS exercise_name,
        exercises.app_exercise_id,
        COALESCE(
          completed_exercises.resolved_tracking_type,
          (SELECT uwe.tracking_type_override FROM user_workout_exercises uwe
           WHERE uwe.workout_id = completed_workouts.workout_id
             AND uwe.exercise_id = completed_exercises.exercise_id
             AND uwe.is_deleted IS NOT TRUE LIMIT 1),
          exercises.tracking_type
        ) AS exercise_tracking_type,
        exercises.tracking_type AS base_tracking_type,
        workout_body_weight.body_weight_kg,
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
      LEFT JOIN workout_body_weight ON workout_body_weight.completed_workout_id = completed_workouts.id
    `;

    const params: (string | number)[] = [];
    query += ` WHERE completed_workouts.is_deleted = FALSE`;
    // Both branches filter on local_date, the training day. date('now') is UTC
    // and date_completed is a UTC instant, so filtering on either put a
    // late-evening or early-morning workout in the wrong period.
    if (startDate && endDate) {
      // Both bounds are inclusive plain date keys, so a workout logged at any
      // time on the end day is counted.
      query += ` AND completed_workouts.local_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (timeRange > 0) {
      const from = new Date();
      from.setDate(from.getDate() - timeRange);
      query += ` AND completed_workouts.local_date >= ?`;
      params.push(toLocalDateKey(from));
    }

    query += `
      ORDER BY completed_workouts.date_completed DESC, completed_exercises.id, completed_sets.set_number;
    `;

    const results = await db.getAllAsync(query, params);

    return (results as WorkoutResult[]).map(withDisplayExerciseName);
  } catch (error: any) {
    console.error("Error fetching completed workouts:", error);
    notifyBugsnag(error);
    // Already reported above; mark the wrapper so the global net skips it.
    const wrappedError = new Error("Failed to fetch completed workouts");
    markReported(wrappedError);
    throw wrappedError;
  } finally {
    if (db) await db.closeAsync();
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

    results.forEach((item) => {
      const {
        id,
        workout_id,
        plan_id,
        workout_name,
        date_completed,
        local_date,
        duration,
        total_sets_completed,
        completed_exercise_id,
        exercise_id,
        exercise_name,
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
          workout_name: workout_name ?? QUICK_WORKOUT_NAME,
          date_completed,
          local_date,
          duration,
          total_sets_completed,
          is_deload: item.is_deload ?? 0,
          body_weight_kg: item.body_weight_kg ?? null,
          exercises: [],
        };
        workoutsMap.set(id, workout);
        workoutsArray.push(workout);
      }

      // Find or create the exercise entry
      let exercise = workout.exercises.find(
        (ex) => ex.completed_exercise_id === completed_exercise_id,
      );

      if (!exercise) {
        exercise = {
          completed_exercise_id,
          exercise_id,
          exercise_name,
          exercise_tracking_type,
          base_tracking_type: item.base_tracking_type ?? null,
          is_unilateral: is_unilateral ?? 0,
          double_weight: double_weight ?? 0,
          sets: [],
        };
        workout.exercises.push(exercise);
      }

      const convertedWeight =
        weight != null
          ? parseFloat(kgToDisplay(weight, weightUnit).toFixed(1))
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
            ? parseFloat(metresToDisplay(distance, distanceUnit).toFixed(2))
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
    // Kept fresh by invalidation from the save/edit/delete mutations, so the
    // full history scan does not need to re-run on every mount.
    staleTime: 60_000,
  });
};

// The window of the same size immediately before the current period, as
// inclusive local date keys. toISOString() would give the UTC day, which is
// the wrong day for anyone far enough from UTC.
export const getPreviousPeriodDates = (
  days: number,
): { startDate: string; endDate: string } => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - days - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  return {
    startDate: toLocalDateKey(startDate),
    endDate: toLocalDateKey(endDate),
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
    // Kept fresh by invalidation from the save/edit/delete mutations, so the
    // full history scan does not need to re-run on every mount.
    staleTime: 60_000,
  });
};

const fetchWorkoutHistoryForSession = async (
  workoutId: number,
  weightUnit: string,
  distanceUnit: string,
): Promise<CompletedWorkout[]> => {
  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");

    const query = `
      SELECT
        cw.id,
        cw.plan_id,
        cw.workout_id,
        uw.name AS workout_name,
        cw.date_completed,
        cw.local_date,
        cw.duration,
        cw.total_sets_completed,
        cw.is_deload,
        ce.id as completed_exercise_id,
        ce.user_workout_exercise_id,
        ce.exercise_id,
        e.name AS exercise_name,
        e.app_exercise_id,
        COALESCE(
          ce.resolved_tracking_type,
          (SELECT uwe.tracking_type_override FROM user_workout_exercises uwe
           WHERE uwe.workout_id = cw.workout_id
             AND uwe.exercise_id = ce.exercise_id
             AND uwe.is_deleted IS NOT TRUE LIMIT 1),
          e.tracking_type
        ) AS exercise_tracking_type,
        e.tracking_type AS base_tracking_type,
        ${bodyWeightAtSql("cw.date_completed")} AS body_weight_kg,
        e.is_unilateral,
        e.double_weight,
        cs.id AS set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration,
        cs.note,
        cw.notes
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

    const results = (
      (await db.getAllAsync(query, [workoutId])) as WorkoutResult[]
    ).map(withDisplayExerciseName);

    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

    results.forEach((item) => {
      const {
        id,
        workout_id,
        plan_id,
        workout_name,
        date_completed,
        local_date,
        duration,
        total_sets_completed,
        completed_exercise_id,
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
          workout_name: workout_name ?? QUICK_WORKOUT_NAME,
          date_completed,
          local_date,
          duration,
          total_sets_completed,
          is_deload: item.is_deload ?? 0,
          notes: item.notes ?? null,
          body_weight_kg: item.body_weight_kg ?? null,
          exercises: [],
        };
        workoutsMap.set(id, workout);
        workoutsArray.push(workout);
      }

      let exercise = workout.exercises.find(
        (ex) => ex.completed_exercise_id === completed_exercise_id,
      );
      if (!exercise) {
        exercise = {
          completed_exercise_id,
          exercise_id,
          user_workout_exercise_id: item.user_workout_exercise_id ?? null,
          exercise_name,
          exercise_tracking_type,
          base_tracking_type: item.base_tracking_type ?? null,
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
            ? parseFloat(kgToDisplay(weight, weightUnit).toFixed(2))
            : null,
        reps,
        time,
        distance:
          distance != null
            ? parseFloat(metresToDisplay(distance, distanceUnit).toFixed(2))
            : null,
        is_warmup: !!is_warmup,
        set_duration: item.set_duration ?? null,
        note: item.note ?? null,
      });
    });

    return workoutsArray;
  } catch (error: any) {
    console.error("Error fetching workout session history:", error);
    notifyBugsnag(error);
    // Already reported above; mark the wrapper so the global net skips it.
    const wrappedError = new Error("Failed to fetch workout session history");
    markReported(wrappedError);
    throw wrappedError;
  } finally {
    if (db) await db.closeAsync();
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
  exerciseIds: number[],
  weightUnit: string,
  distanceUnit: string,
): Promise<CompletedWorkout[]> => {
  if (exerciseIds.length === 0) return [];

  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const placeholders = exerciseIds.map(() => "?").join(", ");

    const query = `
      SELECT
        cw.id,
        cw.plan_id,
        cw.workout_id,
        uw.name AS workout_name,
        cw.date_completed,
        cw.local_date,
        cw.duration,
        cw.total_sets_completed,
        ce.id as completed_exercise_id,
        ce.user_workout_exercise_id,
        ce.exercise_id,
        e.name AS exercise_name,
        e.app_exercise_id,
        COALESCE(
          ce.resolved_tracking_type,
          (SELECT uwe.tracking_type_override FROM user_workout_exercises uwe
           WHERE uwe.workout_id = cw.workout_id
             AND uwe.exercise_id = ce.exercise_id
             AND uwe.is_deleted IS NOT TRUE LIMIT 1),
          e.tracking_type
        ) AS exercise_tracking_type,
        e.is_unilateral,
        e.double_weight,
        cs.id AS set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration,
        cs.note,
        cw.notes
      FROM completed_exercises ce
      JOIN completed_workouts cw ON cw.id = ce.completed_workout_id
      JOIN exercises e ON e.exercise_id = ce.exercise_id
      JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      WHERE cw.is_deleted = FALSE
        AND ce.exercise_id IN (${placeholders})
        AND cw.id = (
          SELECT cw2.id
          FROM completed_workouts cw2
          JOIN completed_exercises ce2 ON ce2.completed_workout_id = cw2.id
          WHERE cw2.is_deleted = FALSE
            AND ce2.exercise_id = ce.exercise_id
          ORDER BY cw2.date_completed DESC, cw2.id DESC
          LIMIT 1
        )
      ORDER BY cw.date_completed DESC, ce.id, cs.set_number
    `;

    const results = (
      (await db.getAllAsync(query, exerciseIds)) as WorkoutResult[]
    ).map(withDisplayExerciseName);

    const workoutsMap = new Map<number, CompletedWorkout>();
    const workoutsArray: CompletedWorkout[] = [];

    results.forEach((item) => {
      const {
        id,
        workout_id,
        plan_id,
        workout_name,
        date_completed,
        local_date,
        duration,
        total_sets_completed,
        completed_exercise_id,
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
          workout_name: workout_name ?? QUICK_WORKOUT_NAME,
          date_completed,
          local_date,
          duration,
          total_sets_completed,
          is_deload: item.is_deload ?? 0,
          notes: item.notes ?? null,
          exercises: [],
        };
        workoutsMap.set(id, workout);
        workoutsArray.push(workout);
      }

      let exercise = workout.exercises.find(
        (ex) => ex.completed_exercise_id === completed_exercise_id,
      );
      if (!exercise) {
        exercise = {
          completed_exercise_id,
          exercise_id,
          user_workout_exercise_id: item.user_workout_exercise_id ?? null,
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
            ? parseFloat(kgToDisplay(weight, weightUnit).toFixed(2))
            : null,
        reps,
        time,
        distance:
          distance != null
            ? parseFloat(metresToDisplay(distance, distanceUnit).toFixed(2))
            : null,
        is_warmup: !!is_warmup,
        set_duration: item.set_duration ?? null,
        note: item.note ?? null,
      });
    });

    return workoutsArray;
  } catch (error: any) {
    console.error("Error fetching global exercise history:", error);
    notifyBugsnag(error);
    // Already reported above; mark the wrapper so the global net skips it.
    const wrappedError = new Error("Failed to fetch global exercise history");
    markReported(wrappedError);
    throw wrappedError;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const useGlobalExerciseHistoryForSessionQuery = (
  exerciseIds: number[],
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  return useQuery<CompletedWorkout[]>({
    queryKey: [
      "globalExerciseHistoryForSession",
      exerciseIds,
      weightUnit,
      distanceUnit,
    ],
    queryFn: () =>
      fetchGlobalExerciseHistoryForSession(
        exerciseIds,
        weightUnit,
        distanceUnit,
      ),
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
