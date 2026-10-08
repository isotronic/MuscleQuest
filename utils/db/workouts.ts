import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import { nowForDb, parseDbTimestamp, toLocalDateKey } from "@/utils/dates";
import { METRIC_EPSILON, kgToDisplay, metresToDisplay } from "@/utils/units";
import { openDatabase } from "./connection";
import { progressionMetricSql } from "./progressionMetricSql";

export interface SavedWorkout {
  planId: number | null;
  workoutId: number | null;
  duration: number;
  totalSetsCompleted: number;
  isDeload?: boolean;
  /** When the workout ended, if not now (a stale session saved later). */
  completedAt?: Date;
  exercises: {
    exercise_id: number;
    resolved_tracking_type?: string | null;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup?: boolean;
      is_drop_set?: boolean;
      is_to_failure?: boolean;
      set_duration?: number | null;
    }[];
  }[];
}

export const saveCompletedWorkout = async (
  planId: number | null,
  workoutId: number | null,
  duration: number,
  totalSetsCompleted: number,
  isDeload: boolean = false,
  exercises: {
    exercise_id: number;
    resolved_tracking_type?: string | null;
    sets: {
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      is_warmup?: boolean;
      is_drop_set?: boolean;
      is_to_failure?: boolean;
      set_duration?: number | null;
    }[];
  }[],
  completedAt?: Date,
) => {
  const db = await openDatabase("userData.db");
  let completedWorkoutId: number;

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // date_completed is the instant (UTC, ISO with an explicit Z); local_date is
      // the training day the workout counts towards. See utils/dates.ts.
      const { utc, localDate } = completedAt
        ? {
            utc: completedAt.toISOString(),
            localDate: toLocalDateKey(completedAt),
          }
        : nowForDb();
      const completedWorkoutResult = await txn.runAsync(
        `INSERT INTO completed_workouts (plan_id, workout_id, date_completed, local_date, duration, total_sets_completed, is_deload) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          planId,
          workoutId,
          utc,
          localDate,
          duration,
          totalSetsCompleted,
          isDeload ? 1 : 0,
        ],
      );

      completedWorkoutId = completedWorkoutResult.lastInsertRowId;

      for (const exercise of exercises) {
        const completedExerciseResult = await txn.runAsync(
          `INSERT INTO completed_exercises (completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?)`,
          [
            completedWorkoutId,
            exercise.exercise_id,
            exercise.resolved_tracking_type ?? null,
          ],
        );

        const completedExerciseId = completedExerciseResult.lastInsertRowId;

        for (const set of exercise.sets) {
          await txn.runAsync(
            `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, time, distance, is_warmup, is_drop_set, is_to_failure, set_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              completedExerciseId,
              set.set_number,
              set.weight,
              set.reps,
              set.time,
              set.distance,
              set.is_warmup ? 1 : 0,
              set.is_drop_set ? 1 : 0,
              set.is_to_failure ? 1 : 0,
              set.set_duration ?? null,
            ],
          );
        }
      }
    });

    return completedWorkoutId!;
  } catch (error: any) {
    console.error("Error saving completed workout: ", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    await db.closeAsync();
  }
};

export const linkCompletedWorkoutToWorkout = async (
  completedWorkoutId: number,
  workoutId: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE completed_workouts SET workout_id = ? WHERE id = ?`,
      [workoutId, completedWorkoutId],
    );
  } catch (error) {
    console.error(
      `Error linking completed workout ${completedWorkoutId} to workout ${workoutId}:`,
      error,
    );
    notifyBugsnag(error as Error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

interface CompletedWorkoutRow {
  id: number;
  plan_id: number;
  workout_id: number;
  workout_name: string;
  is_deload: number;
  date_completed: string;
  local_date: string | null;
  duration: number;
  total_sets_completed: number;
  completed_exercise_id: number | null;
  exercise_id: number | null;
  exercise_name: string | null;
  exercise_image: Uint8Array | null;
  exercise_image_uri: string | null;
  exercise_order: number | null;
  exercise_tracking_type: string | null;
  is_unilateral: number | null;
  double_weight: number | null;
  set_id: number;
  set_number: number | null;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: number | null;
  set_duration: number | null;
}

export const fetchCompletedWorkoutById = async (
  id: number,
  weightUnit: string = "kg",
  distanceUnit: string = "m",
): Promise<CompletedWorkout> => {
  const db = await openDatabase("userData.db");

  try {
    const result = (await db.getAllAsync(
      `
      SELECT
        cw.id,
        cw.plan_id as plan_id,
        cw.workout_id as workout_id,
        COALESCE(uw.name, 'Quick Workout') as workout_name,
        cw.date_completed,
        cw.local_date,
        cw.duration,
        cw.total_sets_completed,
        cw.is_deload,
        ce.id as completed_exercise_id,
        e.exercise_id as exercise_id,
        e.name as exercise_name,
        e.image_uri as exercise_image_uri,
        CASE WHEN e.image_uri IS NULL THEN e.image END as exercise_image,
        COALESCE(ce.resolved_tracking_type, uwe.tracking_type_override, e.tracking_type) as exercise_tracking_type,
        e.is_unilateral,
        e.double_weight,
        cs.id as set_id,
        cs.set_number,
        cs.weight,
        cs.reps,
        cs.time,
        cs.distance,
        cs.is_warmup,
        cs.set_duration,
        uwe.exercise_order -- Include exercise order from user_workout_exercises
      FROM completed_workouts cw
      LEFT JOIN completed_exercises ce ON cw.id = ce.completed_workout_id
      LEFT JOIN exercises e ON e.exercise_id = ce.exercise_id -- Join exercises table for exercise details
      LEFT JOIN completed_sets cs ON ce.id = cs.completed_exercise_id
      LEFT JOIN user_workouts uw ON uw.id = cw.workout_id
      LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = cw.workout_id AND uwe.exercise_id = ce.exercise_id
      WHERE cw.id = ?
      ORDER BY ce.id, cs.set_number;
      `,
      [id],
    )) as CompletedWorkoutRow[];

    if (!result || result.length === 0) {
      throw new Error("No workout found with the provided workoutId.");
    }

    // Initialize the completed workout object
    const workout: CompletedWorkout = {
      id: result[0].id,
      workout_id: result[0].workout_id,
      plan_id: result[0].plan_id,
      workout_name: result[0]?.workout_name || "",
      date_completed: result[0]?.date_completed || "",
      local_date:
        result[0]?.local_date ||
        toLocalDateKey(parseDbTimestamp(result[0]?.date_completed || "")),
      duration: result[0]?.duration || 0,
      total_sets_completed: result[0]?.total_sets_completed || 0,
      is_deload: result[0]?.is_deload ?? 0,
      exercises: [],
    };

    // Temporary map to store exercises with their order
    const exercisesMap: {
      [completed_exercise_id: number]: CompletedWorkout["exercises"][0] & {
        exercise_order: number | null;
        exercise_tracking_type: string;
      };
    } = {};

    result.forEach((row) => {
      if (row.exercise_id) {
        if (!exercisesMap[row.completed_exercise_id!]) {
          exercisesMap[row.completed_exercise_id!] = {
            completed_exercise_id: row.completed_exercise_id!,
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name || "",
            exercise_image: row.exercise_image
              ? Array.from(row.exercise_image)
              : undefined,
            exercise_image_uri: row.exercise_image_uri ?? null,
            exercise_tracking_type: row.exercise_tracking_type || "weight",
            is_unilateral: row.is_unilateral ?? 0,
            double_weight: row.double_weight ?? 0,
            sets: [],
            exercise_order: row.exercise_order, // Track exercise order
          };
        }

        if (row.set_number !== null && row.set_id !== null) {
          const alreadySeen = exercisesMap[
            row.completed_exercise_id!
          ].sets.some((s) => s.set_id === row.set_id);
          if (!alreadySeen) {
            // Convert weight from kg to the user's unit. A missing weight
            // stays null rather than reading as a 0 kg set.
            const weightInKg =
              row.weight == null ? NaN : parseFloat(row.weight.toString());
            const convertedWeight = parseFloat(
              kgToDisplay(weightInKg, weightUnit).toFixed(1),
            );

            const distanceInMeters = parseFloat(
              row.distance?.toString() || "0",
            );
            const convertedDistance = parseFloat(
              metresToDisplay(distanceInMeters, distanceUnit).toFixed(2),
            );

            exercisesMap[row.completed_exercise_id!].sets.push({
              set_id: row.set_id,
              set_number: row.set_number,
              weight: Number.isFinite(convertedWeight) ? convertedWeight : null,
              reps: row.reps || null,
              time: row.time || null,
              distance:
                row.distance !== null && Number.isFinite(distanceInMeters)
                  ? convertedDistance
                  : null,
              is_warmup: !!row.is_warmup,
              set_duration: row.set_duration ?? null,
            });
          }
        }
      }
    });

    // Sort exercises by exercise_order (from template join) with ce.id as stable fallback
    // for swapped exercises where the UWE join returns NULL.
    workout.exercises = Object.values(exercisesMap)
      .sort(
        (a, b) =>
          (a.exercise_order ?? a.completed_exercise_id) -
          (b.exercise_order ?? b.completed_exercise_id),
      )
      .map(({ exercise_order, ...rest }) => rest);

    return workout;
  } catch (error: any) {
    console.error("Error fetching completed workout by ID:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    await db.closeAsync();
  }
};

export const deleteCompletedWorkout = async (id: number): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE completed_sets SET is_deleted = TRUE
       WHERE completed_exercise_id IN (
         SELECT id FROM completed_exercises WHERE completed_workout_id = ?
       )`,
        [id],
      );
      await txn.runAsync(
        `UPDATE completed_exercises SET is_deleted = TRUE WHERE completed_workout_id = ?`,
        [id],
      );
      await txn.runAsync(
        `UPDATE completed_workouts SET is_deleted = TRUE WHERE id = ?`,
        [id],
      );
    });
  } finally {
    await db.closeAsync();
  }
};

/** Undo for deleteCompletedWorkout: clears the same three soft-deletes. */
export const restoreCompletedWorkout = async (id: number): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE completed_workouts SET is_deleted = FALSE WHERE id = ?`,
        [id],
      );
      await txn.runAsync(
        `UPDATE completed_exercises SET is_deleted = FALSE WHERE completed_workout_id = ?`,
        [id],
      );
      await txn.runAsync(
        `UPDATE completed_sets SET is_deleted = FALSE
       WHERE completed_exercise_id IN (
         SELECT id FROM completed_exercises WHERE completed_workout_id = ?
       )`,
        [id],
      );
    });
  } finally {
    await db.closeAsync();
  }
};

export interface WeeklyCompletion {
  id: number;
  week_start: string;
  goal: number;
  completed: number;
  goal_reached: boolean;
}

export const getWeeklyCompletions = async (): Promise<WeeklyCompletion[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    return (await db.getAllAsync(
      `SELECT * FROM weekly_completions ORDER BY week_start DESC`,
    )) as WeeklyCompletion[];
  } catch (error: any) {
    console.error("Error fetching weekly completions:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const upsertWeeklyCompletion = async (
  weekStart: string,
  goal: number,
  completed: number,
  goalReached: boolean,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT OR REPLACE INTO weekly_completions (week_start, goal, completed, goal_reached) VALUES (?, ?, ?, ?)`,
      [weekStart, goal, completed, goalReached ? 1 : 0],
    );
  } catch (error: any) {
    console.error("Error upserting weekly completion:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const fetchSetDurationsForExercises = async (
  exerciseIds: number[],
): Promise<Record<number, { duration: number; reps: number | null }[]>> => {
  if (exerciseIds.length === 0) return {};
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const placeholders = exerciseIds.map(() => "?").join(", ");
    const rows = (await db.getAllAsync(
      `SELECT ce.exercise_id, cs.set_duration, cs.reps
       FROM completed_sets cs
       JOIN completed_exercises ce ON cs.completed_exercise_id = ce.id
       JOIN completed_workouts cw  ON ce.completed_workout_id  = cw.id
       WHERE ce.exercise_id IN (${placeholders})
         AND cs.set_duration > 0
         AND cs.is_deleted   = FALSE
         AND cw.is_deleted   = FALSE
       ORDER BY cw.date_completed DESC`,
      exerciseIds,
    )) as { exercise_id: number; set_duration: number; reps: number | null }[];

    const result: Record<number, { duration: number; reps: number | null }[]> =
      {};
    for (const row of rows) {
      if (!result[row.exercise_id]) {
        result[row.exercise_id] = [];
      }
      result[row.exercise_id].push({
        duration: row.set_duration,
        reps: row.reps,
      });
    }
    return result;
  } catch (error: any) {
    console.error("Error fetching set durations for exercises:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface ExercisePRData {
  exercise_id: number;
  app_exercise_id: number | null;
  exercise_name: string;
  tracking_type: string;
  all_time_pr: number;
  all_time_pr_date: string;
  top_sets: {
    weight: number | null;
    reps: number | null;
    time: number | null;
    distance: number | null;
    date_completed: string;
  }[];
}

export const fetchPRDataForExercises = async (
  exerciseIds: number[],
): Promise<ExercisePRData[]> => {
  if (exerciseIds.length === 0) return [];
  const db = await openDatabase("userData.db");
  try {
    const placeholders = exerciseIds.map(() => "?").join(", ");

    const pmExpr = progressionMetricSql();

    const rows = await db.getAllAsync<{
      exercise_id: number;
      app_exercise_id: number | null;
      exercise_name: string;
      tracking_type: string;
      weight: number | null;
      reps: number | null;
      time: number | null;
      distance: number | null;
      date_completed: string;
      pm: number;
      all_time_pr: number;
      rn: number;
      all_time_pr_date: string;
    }>(
      // The PR date is the earliest set within METRIC_EPSILON of the PR, taken
      // over every set before rn <= 5 trims to the top five. Ties beyond the
      // fifth row, such as a legacy unrounded set under several rounded ones
      // of the same lift, would otherwise lose the date to a later session.
      `SELECT * FROM (
       SELECT *,
         MIN(CASE WHEN pm > all_time_pr - ${METRIC_EPSILON} THEN date_completed END)
           OVER (PARTITION BY exercise_id) AS all_time_pr_date
       FROM (
       SELECT
         e.exercise_id, e.app_exercise_id, e.name AS exercise_name, e.tracking_type,
         cs.weight, cs.reps, cs.time, cs.distance,
         cw.local_date AS date_completed,
         ${pmExpr} AS pm,
         MAX(${pmExpr}) OVER (PARTITION BY e.exercise_id) AS all_time_pr,
         ROW_NUMBER() OVER (PARTITION BY e.exercise_id ORDER BY ${pmExpr} DESC) AS rn
       FROM exercises e
       JOIN completed_exercises ce ON ce.exercise_id = e.exercise_id AND ce.is_deleted = 0
       JOIN completed_sets cs ON cs.completed_exercise_id = ce.id
         AND cs.is_warmup = 0 AND cs.is_deleted = 0
       JOIN completed_workouts cw ON cw.id = ce.completed_workout_id AND cw.is_deleted = 0
       WHERE e.exercise_id IN (${placeholders})
       )
     )
     WHERE rn <= 5`,
      exerciseIds,
    );

    const exerciseMap = new Map<number, ExercisePRData>();
    for (const row of rows) {
      if (!exerciseMap.has(row.exercise_id)) {
        exerciseMap.set(row.exercise_id, {
          exercise_id: row.exercise_id,
          app_exercise_id: row.app_exercise_id,
          exercise_name: row.exercise_name,
          tracking_type: row.tracking_type,
          all_time_pr: row.all_time_pr,
          all_time_pr_date: row.all_time_pr_date,
          top_sets: [],
        });
      }
      exerciseMap.get(row.exercise_id)!.top_sets.push({
        weight: row.weight,
        reps: row.reps,
        time: row.time,
        distance: row.distance,
        date_completed: row.date_completed,
      });
    }

    return Array.from(exerciseMap.values());
  } finally {
    await db.closeAsync();
  }
};
