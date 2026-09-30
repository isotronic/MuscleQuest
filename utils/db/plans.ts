import { UserExercise, Workout } from "@/store/workoutStore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import { openDatabase } from "./connection";

export const fetchActivePlan = async () => {
  const db = await openDatabase("userData.db");
  try {
    return await db.getFirstAsync(
      `SELECT * FROM user_plans WHERE is_active = true`,
    );
  } finally {
    await db.closeAsync();
  }
};

export const fetchAllPlanIds = async (): Promise<number[]> => {
  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM user_plans WHERE app_plan_id IS NULL AND is_deleted = FALSE`,
    );
    return rows.map((r) => r.id);
  } finally {
    await db.closeAsync();
  }
};

export const updateActivePlan = async (id: number) => {
  const db = await openDatabase("userData.db");
  try {
    await db.runAsync(
      `UPDATE user_plans SET is_active = false WHERE is_active = true`,
    );
    await db.runAsync(`UPDATE user_plans SET is_active = true WHERE id = ?`, [
      id,
    ]);
  } finally {
    await db.closeAsync();
  }
};

export const insertWorkoutPlan = async (
  name: string,
  image_url: string,
  workouts: Workout[],
): Promise<number | null> => {
  const db = await openDatabase("userData.db"); // Open database once
  try {
    let newPlanId: number | null = null;

    // Start the transaction
    await db.withExclusiveTransactionAsync(async (txn) => {
      try {
        // Insert the plan
        const result = await txn.runAsync(
          `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
          [name, image_url],
        );

        newPlanId = result.lastInsertRowId;

        // Insert the workouts associated with this plan
        await insertWorkouts(txn, newPlanId, workouts);
      } catch (error: any) {
        console.error("Error inserting workout plan:", error);
        notifyBugsnag(error);
        throw error;
      }
    });

    return newPlanId;
  } finally {
    await db.closeAsync();
  }
};

export const insertWorkouts = async (
  txn: SQLite.SQLiteDatabase, // Pass transaction to avoid nested transactions
  planId: number,
  workouts: Workout[],
) => {
  try {
    for (const [workoutOrder, workout] of workouts.entries()) {
      const { exercises, name } = workout;
      const workoutName = name || `Workout ${workoutOrder + 1}`;

      // Insert the workout and get the inserted workout ID
      const result = await txn.runAsync(
        `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
        [planId, workoutName, workoutOrder],
      );

      const workoutId = result.lastInsertRowId;

      // Insert exercises related to this workout
      for (const [exerciseOrder, exercise] of exercises.entries()) {
        const { exercise_id, sets } = exercise;

        // Insert into user_workout_exercises
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (
            workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise_id,
            JSON.stringify(sets),
            exerciseOrder,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    }
  } catch (error: any) {
    console.error("Error inserting workouts:", error);
    notifyBugsnag(error);
    throw error; // Re-throw the error to trigger transaction rollback
  }
};

export const updateWorkoutPlan = async (
  id: number,
  name: string,
  image_url: string,
  workouts: Workout[],
) => {
  const db = await openDatabase("userData.db");

  try {
    // Start the transaction for the entire update process
    await db.withExclusiveTransactionAsync(async (txn) => {
      try {
        // Update the workout plan details
        await txn.runAsync(
          `UPDATE user_plans SET name = ?, image_url = ? WHERE id = ?`,
          [name, image_url, id],
        );

        // Fetch existing workouts for the plan
        const existingWorkouts: { id: number }[] = await txn.getAllAsync(
          `SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE`,
          [id],
        );

        // Find and mark workouts for deletion that are not in the new workout list
        const workoutIdsToKeep = workouts.map((w) => w.id).filter(Boolean); // Filter out new workouts (no ID)
        const workoutsToDelete = existingWorkouts.filter(
          (w) => !workoutIdsToKeep.includes(w.id),
        );

        for (const workout of workoutsToDelete) {
          await txn.runAsync(
            `UPDATE user_workouts SET is_deleted = TRUE WHERE id = ?`,
            [workout.id],
          );
          await txn.runAsync(
            `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE workout_id = ?`,
            [workout.id],
          );
        }

        // Iterate through new or updated workouts
        for (const [workoutOrder, workout] of workouts.entries()) {
          let workoutId = workout.id;
          const workoutName = workout.name || `Workout ${workoutOrder + 1}`;

          if (!workoutId || workoutId < 0) {
            // Insert new workout (workoutId is null/undefined for brand-new workouts,
            // or negative (temp ID like -Date.now()) for workouts added during plan editing)
            const result = await txn.runAsync(
              `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
              [id, workoutName, workoutOrder],
            );
            workoutId = result.lastInsertRowId;
          } else {
            // Update existing workout name and order
            await txn.runAsync(
              `UPDATE user_workouts SET name = ?, workout_order = ? WHERE id = ?`,
              [workoutName, workoutOrder, workoutId],
            );
          }

          // Fetch existing exercises for the workout
          const existingExercises: { id: number; exercise_id: number }[] =
            await txn.getAllAsync(
              `SELECT id, exercise_id FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
              [workoutId],
            );
          const existingExerciseIds = existingExercises.map(
            (e) => e.exercise_id,
          );

          // Find and mark exercises for deletion that are not in the updated workout
          const exerciseIdsToKeep = workout.exercises.map((e) => e.exercise_id);
          const exercisesToDelete = existingExercises.filter(
            (e) => !exerciseIdsToKeep.includes(e.exercise_id),
          );

          for (const exercise of exercisesToDelete) {
            await txn.runAsync(
              `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE id = ?`,
              [exercise.id],
            );
          }

          // Insert or update exercises and sets
          for (const [exerciseOrder, exercise] of workout.exercises.entries()) {
            if (!existingExerciseIds.includes(exercise.exercise_id)) {
              // Insert new exercise
              await txn.runAsync(
                `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  workoutId,
                  exercise.exercise_id,
                  JSON.stringify(exercise.sets),
                  exerciseOrder,
                  exercise.supersetGroupId ?? null,
                  exercise.tracking_type_override ?? null,
                ],
              );
            } else {
              // Update existing exercise
              await txn.runAsync(
                `UPDATE user_workout_exercises SET sets = ?, exercise_order = ?, superset_group_id = ?, tracking_type_override = ? WHERE workout_id = ? AND exercise_id = ?`,
                [
                  JSON.stringify(exercise.sets),
                  exerciseOrder,
                  exercise.supersetGroupId ?? null,
                  exercise.tracking_type_override ?? null,
                  workoutId,
                  exercise.exercise_id,
                ],
              );
            }
          }
        }
      } catch (error: any) {
        console.error("Error updating workout plan:", error);
        notifyBugsnag(error);
        throw error;
      }
    });
  } finally {
    await db.closeAsync();
  }
};

export const appendExercisesToWorkout = async (
  workoutId: number,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const row: { maxOrder: number } | null = await txn.getFirstAsync(
        `SELECT COALESCE(MAX(exercise_order), -1) as maxOrder FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
        [workoutId],
      );
      const baseOrder = (row?.maxOrder ?? -1) + 1;
      for (const [i, exercise] of exercises.entries()) {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            workoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            baseOrder + i,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    });
  } finally {
    await db.closeAsync();
  }
};

export const updatePlanWorkoutExercises = async (
  workoutId: number,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing: {
        id: number;
        exercise_id: number;
        exercise_order: number;
      }[] = await txn.getAllAsync(
        `SELECT id, exercise_id, exercise_order FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
        [workoutId],
      );
      const existingById = new Map(existing.map((e) => [e.id, e]));
      const matchedIds = new Set<number>();

      for (const [order, exercise] of exercises.entries()) {
        const existingRow =
          exercise.id !== undefined ? existingById.get(exercise.id) : undefined;
        if (existingRow) {
          matchedIds.add(existingRow.id);
          await txn.runAsync(
            `UPDATE user_workout_exercises SET exercise_id = ?, sets = ?, exercise_order = ?, superset_group_id = ?, tracking_type_override = ?, is_deleted = FALSE WHERE id = ?`,
            [
              exercise.exercise_id,
              JSON.stringify(exercise.sets),
              order,
              exercise.supersetGroupId ?? null,
              exercise.tracking_type_override ?? null,
              existingRow.id,
            ],
          );
        } else {
          await txn.runAsync(
            `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              workoutId,
              exercise.exercise_id,
              JSON.stringify(exercise.sets),
              order,
              exercise.supersetGroupId ?? null,
              exercise.tracking_type_override ?? null,
            ],
          );
        }
      }

      for (const row of existing) {
        if (!matchedIds.has(row.id)) {
          await txn.runAsync(
            `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE id = ?`,
            [row.id],
          );
        }
      }
    });
  } finally {
    await db.closeAsync();
  }
};

/** The rows deleteWorkoutPlan soft-deleted, so an undo restores only those. */
export interface DeletedPlanSnapshot {
  planId: number;
  workoutIds: number[];
  workoutExerciseIds: number[];
}

export const deleteWorkoutPlan = async (
  planId: number,
): Promise<DeletedPlanSnapshot> => {
  const db = await openDatabase("userData.db");
  const snapshot: DeletedPlanSnapshot = {
    planId,
    workoutIds: [],
    workoutExerciseIds: [],
  };

  try {
    // Start an exclusive transaction to ensure that all updates are executed together
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Workouts and exercises removed earlier (plan edits) are already
      // soft-deleted; recording only the live ones keeps undo from reviving them.
      const workouts = await txn.getAllAsync<{ id: number }>(
        `SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE`,
        [planId],
      );
      const exercises = await txn.getAllAsync<{ id: number }>(
        `SELECT id FROM user_workout_exercises
       WHERE is_deleted = FALSE AND workout_id IN (
         SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE
       )`,
        [planId],
      );
      snapshot.workoutIds = workouts.map((w) => w.id);
      snapshot.workoutExerciseIds = exercises.map((e) => e.id);

      // Mark exercises associated with workouts under the plan as deleted
      await txn.runAsync(
        `UPDATE user_workout_exercises
       SET is_deleted = TRUE
       WHERE workout_id IN (
         SELECT id FROM user_workouts WHERE plan_id = ?
       )`,
        [planId],
      );

      // Mark workouts associated with the plan as deleted
      await txn.runAsync(
        `UPDATE user_workouts
       SET is_deleted = TRUE
       WHERE plan_id = ?`,
        [planId],
      );

      // Finally, mark the plan itself as deleted
      await txn.runAsync(
        `UPDATE user_plans
       SET is_deleted = TRUE
       WHERE id = ?`,
        [planId],
      );
    });
  } finally {
    await db.closeAsync();
  }
  return snapshot;
};

/** Undo for deleteWorkoutPlan. */
export const restoreWorkoutPlan = async ({
  planId,
  workoutIds,
  workoutExerciseIds,
}: DeletedPlanSnapshot): Promise<void> => {
  const placeholders = (ids: number[]) => ids.map(() => "?").join(", ");
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE user_plans SET is_deleted = FALSE WHERE id = ?`,
        [planId],
      );
      if (workoutIds.length > 0) {
        await txn.runAsync(
          `UPDATE user_workouts SET is_deleted = FALSE WHERE id IN (${placeholders(workoutIds)})`,
          workoutIds,
        );
      }
      if (workoutExerciseIds.length > 0) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET is_deleted = FALSE WHERE id IN (${placeholders(workoutExerciseIds)})`,
          workoutExerciseIds,
        );
      }
    });
  } finally {
    await db.closeAsync();
  }
};

export interface PlanScheduleEntry {
  day_of_week: number; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  workout_id: number;
}

export const fetchPlanSchedule = async (
  planId: number,
): Promise<PlanScheduleEntry[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    return await db.getAllAsync<PlanScheduleEntry>(
      `SELECT day_of_week, workout_id FROM plan_schedule WHERE plan_id = ? ORDER BY day_of_week`,
      [planId],
    );
  } catch (error: any) {
    console.error("Error fetching plan schedule:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const savePlanSchedule = async (
  planId: number,
  entries: PlanScheduleEntry[],
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(`DELETE FROM plan_schedule WHERE plan_id = ?`, [
        planId,
      ]);
      for (const entry of entries) {
        await txn.runAsync(
          `INSERT INTO plan_schedule (plan_id, day_of_week, workout_id) VALUES (?, ?, ?)`,
          [planId, entry.day_of_week, entry.workout_id],
        );
      }
    });
  } catch (error) {
    console.error(`Error in savePlanSchedule for planId ${planId}:`, error);
    notifyBugsnag(error as Error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const duplicatePlan = async (
  planId: number,
  planName: string,
  imageUrl: string | null,
): Promise<number> => {
  const db = await openDatabase("userData.db");
  try {
    let newPlanId = 0;
    const oldToNewWorkoutId: Record<number, number> = {};

    await db.withExclusiveTransactionAsync(async (txn) => {
      const sourcePlan = await txn.getFirstAsync<{ id: number }>(
        `SELECT id FROM user_plans WHERE id = ?`,
        [planId],
      );
      if (!sourcePlan) {
        throw new Error(`Cannot duplicate plan ${planId}: plan does not exist`);
      }

      const planResult = await txn.runAsync(
        `INSERT INTO user_plans (name, image_url) VALUES (?, ?)`,
        [planName, imageUrl],
      );
      newPlanId = planResult.lastInsertRowId;

      const workouts = await txn.getAllAsync<{
        id: number;
        name: string;
        workout_order: number;
      }>(
        `SELECT id, name, workout_order FROM user_workouts WHERE plan_id = ? AND is_deleted = FALSE ORDER BY workout_order ASC`,
        [planId],
      );

      for (const workout of workouts) {
        const workoutResult = await txn.runAsync(
          `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (?, ?, ?)`,
          [newPlanId, workout.name, workout.workout_order],
        );
        const newWorkoutId = workoutResult.lastInsertRowId;
        oldToNewWorkoutId[workout.id] = newWorkoutId;

        const exercises = await txn.getAllAsync<{
          exercise_id: number;
          sets: string;
          exercise_order: number;
          superset_group_id: string | null;
          tracking_type_override: string | null;
        }>(
          `SELECT exercise_id, sets, exercise_order, superset_group_id, tracking_type_override FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE ORDER BY exercise_order ASC`,
          [workout.id],
        );

        for (const exercise of exercises) {
          await txn.runAsync(
            `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              newWorkoutId,
              exercise.exercise_id,
              exercise.sets,
              exercise.exercise_order,
              exercise.superset_group_id,
              exercise.tracking_type_override,
            ],
          );
        }
      }

      const scheduleEntries = await txn.getAllAsync<{
        day_of_week: number;
        workout_id: number;
      }>(
        `SELECT day_of_week, workout_id FROM plan_schedule WHERE plan_id = ?`,
        [planId],
      );

      for (const entry of scheduleEntries) {
        const newWorkoutId = oldToNewWorkoutId[entry.workout_id];
        if (newWorkoutId != null) {
          await txn.runAsync(
            `INSERT INTO plan_schedule (plan_id, day_of_week, workout_id) VALUES (?, ?, ?)`,
            [newPlanId, entry.day_of_week, newWorkoutId],
          );
        }
      }
    });

    return newPlanId;
  } finally {
    await db.closeAsync();
  }
};
