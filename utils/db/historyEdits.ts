import type { SQLiteDatabase } from "expo-sqlite";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { toLocalDateKey } from "@/utils/dates";
import { weekEndKey, weekStartKeyFor } from "@/utils/trainingWeek";
import { openDatabase } from "./connection";

export type SetField = "weight" | "reps" | "time" | "distance";

/** Set values as stored: kg, metres, seconds. */
export type StoredSetValues = Record<SetField, number | null>;

export interface SetFlags {
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

export interface NewCompletedSet {
  values: StoredSetValues;
  flags: SetFlags;
  note?: string | null;
}

/**
 * One change to a saved workout. Values are already in storage units; the
 * caller emits an op only for what the user changed, so untouched values
 * never take a display round trip.
 */
export type HistoryEditOp =
  | { kind: "setValues"; setId: number; values: Partial<StoredSetValues> }
  | ({ kind: "setFlags"; setId: number } & SetFlags)
  | { kind: "setNote"; setId: number; note: string | null }
  | {
      kind: "addSet";
      completedExerciseId: number;
      set: NewCompletedSet;
    }
  | { kind: "removeSet"; setId: number }
  | {
      kind: "addExercise";
      exerciseId: number;
      trackingType: string;
      sets: NewCompletedSet[];
    }
  | { kind: "removeExercise"; completedExerciseId: number }
  | {
      kind: "replaceExercise";
      completedExerciseId: number;
      exerciseId: number;
      trackingType: string;
    }
  | {
      kind: "workoutMeta";
      completedAt?: Date;
      durationSeconds?: number;
      notes?: string | null;
    };

/** A finish time after now. The editor blocks it; this is the backstop. */
export class FutureWorkoutDateError extends Error {
  constructor() {
    super("A workout cannot finish in the future.");
    this.name = "FutureWorkoutDateError";
  }
}

// A minute of slack, so "now" picked in the editor is still valid on save.
const FUTURE_SLACK_MS = 60_000;

export const assertNotFuture = (completedAt: Date) => {
  if (completedAt.getTime() > Date.now() + FUTURE_SLACK_MS) {
    throw new FutureWorkoutDateError();
  }
};

const noteOrNull = (note: string | null | undefined): string | null => {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
};

const insertSet = (
  txn: SQLiteDatabase,
  completedExerciseId: number,
  setNumber: number,
  { values, flags, note }: NewCompletedSet,
) =>
  txn.runAsync(
    `INSERT INTO completed_sets (completed_exercise_id, set_number, weight, reps, time, distance, is_warmup, is_drop_set, is_to_failure, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      completedExerciseId,
      setNumber,
      values.weight,
      values.reps,
      values.time,
      values.distance,
      flags.isWarmup ? 1 : 0,
      flags.isDropSet ? 1 : 0,
      flags.isToFailure ? 1 : 0,
      noteOrNull(note),
    ],
  );

/** Numbers an exercise's sets 1..n again, keeping their order. */
const renumberSets = async (
  txn: SQLiteDatabase,
  completedExerciseId: number,
) => {
  const rows = await txn.getAllAsync<{ id: number; set_number: number }>(
    `SELECT id, set_number FROM completed_sets
     WHERE completed_exercise_id = ?
     ORDER BY set_number, id`,
    [completedExerciseId],
  );
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].set_number !== i + 1) {
      await txn.runAsync(
        `UPDATE completed_sets SET set_number = ? WHERE id = ?`,
        [i + 1, rows[i].id],
      );
    }
  }
};

/**
 * Recounts the training days of one recorded week after a workout moved into
 * or out of it, or was logged late. The recorded goal is kept. A week with no
 * row yet is left to useWeeklyStreak, which records weeks as they end.
 */
export const recountWeeklyCompletion = async (
  txn: SQLiteDatabase,
  weekStart: string,
): Promise<void> => {
  const row = await txn.getFirstAsync<{ days: number }>(
    `SELECT COUNT(DISTINCT local_date) AS days FROM completed_workouts
     WHERE is_deleted = 0 AND local_date BETWEEN ? AND ?`,
    [weekStart, weekEndKey(weekStart)],
  );
  const days = row?.days ?? 0;
  await txn.runAsync(
    `UPDATE weekly_completions
     SET completed = ?, goal_reached = CASE WHEN ? >= goal THEN 1 ELSE 0 END
     WHERE week_start = ?`,
    [days, days, weekStart],
  );
};

const applyOp = async (
  txn: SQLiteDatabase,
  completedWorkoutId: number,
  op: HistoryEditOp,
  touchedExercises: Set<number>,
) => {
  switch (op.kind) {
    case "setValues": {
      const fields = Object.keys(op.values) as SetField[];
      if (fields.length === 0) return;
      await txn.runAsync(
        `UPDATE completed_sets SET ${fields
          .map((field) => `${field} = ?`)
          .join(", ")} WHERE id = ?`,
        [...fields.map((field) => op.values[field] ?? null), op.setId],
      );
      return;
    }
    case "setFlags":
      await txn.runAsync(
        `UPDATE completed_sets SET is_warmup = ?, is_drop_set = ?, is_to_failure = ? WHERE id = ?`,
        [
          op.isWarmup ? 1 : 0,
          op.isDropSet ? 1 : 0,
          op.isToFailure ? 1 : 0,
          op.setId,
        ],
      );
      return;
    case "setNote":
      await txn.runAsync(`UPDATE completed_sets SET note = ? WHERE id = ?`, [
        noteOrNull(op.note),
        op.setId,
      ]);
      return;
    case "addSet": {
      // Appended after the last set; renumbering closes any gaps.
      const last = await txn.getFirstAsync<{ n: number | null }>(
        `SELECT MAX(set_number) AS n FROM completed_sets WHERE completed_exercise_id = ?`,
        [op.completedExerciseId],
      );
      await insertSet(txn, op.completedExerciseId, (last?.n ?? 0) + 1, op.set);
      touchedExercises.add(op.completedExerciseId);
      return;
    }
    case "removeSet": {
      // Removed outright rather than flagged: many history and stats reads
      // do not filter completed_sets.is_deleted, and undoing a workout delete
      // clears that flag on every set.
      const row = await txn.getFirstAsync<{ completed_exercise_id: number }>(
        `SELECT completed_exercise_id FROM completed_sets WHERE id = ?`,
        [op.setId],
      );
      await txn.runAsync(`DELETE FROM completed_sets WHERE id = ?`, [op.setId]);
      if (row) touchedExercises.add(row.completed_exercise_id);
      return;
    }
    case "addExercise": {
      const result = await txn.runAsync(
        `INSERT INTO completed_exercises (completed_workout_id, exercise_id, resolved_tracking_type) VALUES (?, ?, ?)`,
        [completedWorkoutId, op.exerciseId, op.trackingType],
      );
      for (let i = 0; i < op.sets.length; i++) {
        await insertSet(txn, result.lastInsertRowId, i + 1, op.sets[i]);
      }
      return;
    }
    case "removeExercise":
      // Nothing but its sets references a completed exercise.
      await txn.runAsync(
        `DELETE FROM completed_sets WHERE completed_exercise_id = ?`,
        [op.completedExerciseId],
      );
      await txn.runAsync(
        `DELETE FROM completed_exercises WHERE id = ? AND completed_workout_id = ?`,
        [op.completedExerciseId, completedWorkoutId],
      );
      touchedExercises.delete(op.completedExerciseId);
      return;
    case "replaceExercise":
      await txn.runAsync(
        `UPDATE completed_exercises SET exercise_id = ?, resolved_tracking_type = ? WHERE id = ?`,
        [op.exerciseId, op.trackingType, op.completedExerciseId],
      );
      return;
    case "workoutMeta": {
      if (op.completedAt) {
        assertNotFuture(op.completedAt);
        await txn.runAsync(
          `UPDATE completed_workouts SET date_completed = ?, local_date = ? WHERE id = ?`,
          [
            op.completedAt.toISOString(),
            toLocalDateKey(op.completedAt),
            completedWorkoutId,
          ],
        );
      }
      if (op.durationSeconds !== undefined) {
        await txn.runAsync(
          `UPDATE completed_workouts SET duration = ? WHERE id = ?`,
          [Math.max(0, Math.round(op.durationSeconds)), completedWorkoutId],
        );
      }
      if (op.notes !== undefined) {
        await txn.runAsync(
          `UPDATE completed_workouts SET notes = ? WHERE id = ?`,
          [noteOrNull(op.notes), completedWorkoutId],
        );
      }
      return;
    }
  }
};

const changesSetCount = (op: HistoryEditOp) =>
  op.kind === "addSet" ||
  op.kind === "removeSet" ||
  op.kind === "addExercise" ||
  op.kind === "removeExercise";

export interface HistoryEditResult {
  /** The training day before and after; they differ when the date moved. */
  previousLocalDate: string | null;
  localDate: string | null;
}

/**
 * Applies a list of edits to one saved workout in a single transaction, then
 * renumbers sets, recounts the session's set total and, if the workout moved
 * to another week, both weeks' recorded completions.
 */
export const applyHistoryEdits = async (
  completedWorkoutId: number,
  ops: readonly HistoryEditOp[],
): Promise<HistoryEditResult> => {
  let db: SQLiteDatabase | undefined;
  const result: HistoryEditResult = {
    previousLocalDate: null,
    localDate: null,
  };
  try {
    db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      const readLocalDate = async () =>
        (
          await txn.getFirstAsync<{ local_date: string | null }>(
            `SELECT local_date FROM completed_workouts WHERE id = ?`,
            [completedWorkoutId],
          )
        )?.local_date ?? null;

      result.previousLocalDate = await readLocalDate();
      const touchedExercises = new Set<number>();
      for (const op of ops) {
        await applyOp(txn, completedWorkoutId, op, touchedExercises);
      }
      for (const completedExerciseId of touchedExercises) {
        await renumberSets(txn, completedExerciseId);
      }
      if (ops.some(changesSetCount)) {
        await txn.runAsync(
          `UPDATE completed_workouts SET total_sets_completed = (
             SELECT COUNT(*) FROM completed_sets cs
             JOIN completed_exercises ce ON ce.id = cs.completed_exercise_id
             WHERE ce.completed_workout_id = ?
           ) WHERE id = ?`,
          [completedWorkoutId, completedWorkoutId],
        );
      }
      result.localDate = await readLocalDate();
      if (result.localDate !== result.previousLocalDate) {
        const weeks = new Set(
          [result.previousLocalDate, result.localDate]
            .filter((d): d is string => !!d)
            .map(weekStartKeyFor),
        );
        for (const weekStart of weeks) {
          await recountWeeklyCompletion(txn, weekStart);
        }
      }
    });
    return result;
  } catch (error) {
    console.error("Error saving edited workout:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};
