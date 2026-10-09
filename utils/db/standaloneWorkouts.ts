import { UserExercise, Workout } from "@/store/workoutStore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { openDatabase } from "./connection";

export const fetchAllStandaloneWorkoutIds = async (): Promise<number[]> => {
  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM user_workouts WHERE plan_id IS NULL AND is_deleted = FALSE`,
    );
    return rows.map((r) => r.id);
  } finally {
    await db.closeAsync();
  }
};

/** Soft-deleted standalone workouts; see fetchDeletedPlanIds. */
export const fetchDeletedStandaloneWorkoutIds = async (): Promise<number[]> => {
  const db = await openDatabase("userData.db");
  try {
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM user_workouts WHERE plan_id IS NULL AND is_deleted = TRUE`,
    );
    return rows.map((r) => r.id);
  } finally {
    await db.closeAsync();
  }
};

interface RawStandaloneWorkout {
  workout_id: number;
  workout_name: string;
  image_url: string | null;
  uwe_exercise_id: number | null;
  exercise_id: number | null;
  exercise_name: string | null;
  description: string | null;
  image: Uint8Array | null;
  image_uri: string | null;
  local_animated_uri: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number | null;
  superset_group_id: string | null;
}

export const getStandaloneWorkouts = async (): Promise<Workout[]> => {
  const db = await openDatabase("userData.db");
  try {
    const rows = (await db.getAllAsync(`
    SELECT
      uw.id AS workout_id,
      uw.name AS workout_name,
      uw.image_url,
      uwe.id AS uwe_exercise_id,
      e.exercise_id,
      e.name AS exercise_name,
      e.description,
      e.image_uri,
      CASE WHEN e.image_uri IS NULL THEN e.image END AS image,
      e.local_animated_uri,
      e.animated_url,
      e.equipment,
      e.body_part,
      e.target_muscle,
      e.secondary_muscles,
      e.tracking_type,
      uwe.tracking_type_override,
      uwe.sets,
      uwe.exercise_order,
      uwe.superset_group_id
    FROM user_workouts uw
    LEFT JOIN user_workout_exercises uwe ON uwe.workout_id = uw.id AND uwe.is_deleted = FALSE
    LEFT JOIN exercises e ON e.exercise_id = uwe.exercise_id
    WHERE uw.plan_id IS NULL AND uw.is_deleted = FALSE
    ORDER BY uw.id DESC, uwe.exercise_order ASC
  `)) as RawStandaloneWorkout[];

    const workoutsMap = new Map<number, Workout>();
    for (const row of rows) {
      let workout = workoutsMap.get(row.workout_id);
      if (!workout) {
        workout = {
          id: row.workout_id,
          name: row.workout_name,
          exercises: [],
        };
        workoutsMap.set(row.workout_id, workout);
      }
      if (row.exercise_id && row.exercise_name) {
        workout.exercises.push({
          exercise_id: row.exercise_id,
          name: row.exercise_name,
          description: row.description || "",
          image: row.image ? Array.from(row.image) : [],
          image_uri: row.image_uri ?? null,
          local_animated_uri: row.local_animated_uri || "",
          animated_url: row.animated_url || "",
          equipment: row.equipment || "",
          body_part: row.body_part || "",
          target_muscle: row.target_muscle || "",
          secondary_muscles: (() => {
            try {
              return row.secondary_muscles
                ? JSON.parse(row.secondary_muscles)
                : [];
            } catch (e: any) {
              notifyBugsnag(e);
              return [];
            }
          })(),
          tracking_type: row.tracking_type ?? undefined,
          tracking_type_override: row.tracking_type_override ?? undefined,
          sets: (() => {
            try {
              return row.sets ? JSON.parse(row.sets) : [];
            } catch (e: any) {
              notifyBugsnag(e);
              return [];
            }
          })(),
          supersetGroupId: row.superset_group_id ?? undefined,
        });
      }
    }
    return Array.from(workoutsMap.values());
  } finally {
    await db.closeAsync();
  }
};

export const createStandaloneWorkout = async (
  name: string,
  exercises: UserExercise[],
): Promise<number> => {
  const db = await openDatabase("userData.db");
  try {
    let newWorkoutId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        `INSERT INTO user_workouts (plan_id, name, workout_order) VALUES (NULL, ?, 0)`,
        [name],
      );
      newWorkoutId = result.lastInsertRowId;
      for (const [order, exercise] of exercises.entries()) {
        await txn.runAsync(
          `INSERT INTO user_workout_exercises (workout_id, exercise_id, sets, exercise_order, superset_group_id, tracking_type_override) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newWorkoutId,
            exercise.exercise_id,
            JSON.stringify(exercise.sets),
            order,
            exercise.supersetGroupId ?? null,
            exercise.tracking_type_override ?? null,
          ],
        );
      }
    });
    return newWorkoutId;
  } finally {
    await db.closeAsync();
  }
};

export const updateStandaloneWorkout = async (
  workoutId: number,
  name: string,
  exercises: UserExercise[],
): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(`UPDATE user_workouts SET name = ? WHERE id = ?`, [
        name,
        workoutId,
      ]);

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

      // Update by row id or insert new rows
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

      // Soft-delete rows that were not matched by id in the incoming list
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

/** The exercise rows deleteStandaloneWorkout soft-deleted, for undo. */
export interface DeletedStandaloneWorkoutSnapshot {
  workoutId: number;
  workoutExerciseIds: number[];
}

export const deleteStandaloneWorkout = async (
  workoutId: number,
): Promise<DeletedStandaloneWorkoutSnapshot> => {
  const db = await openDatabase("userData.db");
  const snapshot: DeletedStandaloneWorkoutSnapshot = {
    workoutId,
    workoutExerciseIds: [],
  };
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Exercises removed in earlier edits stay deleted after an undo.
      const exercises = await txn.getAllAsync<{ id: number }>(
        `SELECT id FROM user_workout_exercises WHERE workout_id = ? AND is_deleted = FALSE`,
        [workoutId],
      );
      snapshot.workoutExerciseIds = exercises.map((e) => e.id);
      await txn.runAsync(
        `UPDATE user_workout_exercises SET is_deleted = TRUE WHERE workout_id = ?`,
        [workoutId],
      );
      await txn.runAsync(
        `UPDATE user_workouts SET is_deleted = TRUE WHERE id = ?`,
        [workoutId],
      );
    });
  } finally {
    await db.closeAsync();
  }
  return snapshot;
};

/** Undo for deleteStandaloneWorkout. */
export const restoreStandaloneWorkout = async ({
  workoutId,
  workoutExerciseIds,
}: DeletedStandaloneWorkoutSnapshot): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE user_workouts SET is_deleted = FALSE WHERE id = ?`,
        [workoutId],
      );
      if (workoutExerciseIds.length > 0) {
        await txn.runAsync(
          `UPDATE user_workout_exercises SET is_deleted = FALSE WHERE id IN (${workoutExerciseIds.map(() => "?").join(", ")})`,
          workoutExerciseIds,
        );
      }
    });
  } finally {
    await db.closeAsync();
  }
};
