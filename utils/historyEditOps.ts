import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import type {
  HistoryEditOp,
  NewCompletedSet,
  SetField,
  StoredSetValues,
} from "@/utils/db/historyEdits";
import type { SavedWorkout } from "@/utils/db/workouts";
import { displayToKg, displayToMetres, roundCanonical } from "@/utils/units";
import { localDateKeyToDate } from "@/utils/dates";

type EditedExercise = CompletedWorkout["exercises"][number];
type EditedSet = EditedExercise["sets"][number];

/** A saved workout as the history editor holds it, set values in display units. */
export interface EditableWorkout {
  /**
   * Exercises and sets the editor added have negative ids
   * (completed_exercise_id, set_id) until they are saved.
   */
  exercises: EditedExercise[];
  /** When the workout finished. */
  completedAt: Date;
  durationSeconds: number;
  notes: string | null;
}

const SET_FIELDS: SetField[] = ["weight", "reps", "time", "distance"];

export const isUnsavedId = (id: number) => id < 0;

/**
 * Converts one edited display value back to storage. Null stays null: a
 * missing weight is not a 0 kg set. Rounded so the same input always stores
 * the same value; see roundCanonical.
 */
const toStored = (
  field: SetField,
  value: number | null,
  weightUnit: string,
  distanceUnit: string,
): number | null => {
  if (value == null) return null;
  if (field === "weight") return roundCanonical(displayToKg(value, weightUnit));
  if (field === "distance")
    return roundCanonical(displayToMetres(value, distanceUnit));
  return value;
};

const sameNote = (a: string | null | undefined, b: string | null | undefined) =>
  (a?.trim() || null) === (b?.trim() || null);

const flagsOf = (set: EditedSet) => ({
  isWarmup: !!set.is_warmup,
  isDropSet: !!set.is_drop_set,
  isToFailure: !!set.is_to_failure,
});

const newSet = (
  set: EditedSet,
  weightUnit: string,
  distanceUnit: string,
): NewCompletedSet => ({
  values: Object.fromEntries(
    SET_FIELDS.map((field) => [
      field,
      toStored(field, set[field] ?? null, weightUnit, distanceUnit),
    ]),
  ) as StoredSetValues,
  flags: flagsOf(set),
  note: set.note ?? null,
});

/**
 * The operations that turn `original` into `edited`. Only what the user
 * changed is written: untouched values went through a display round trip
 * (kg to lbs to one decimal and back), so writing them would silently alter
 * history.
 */
export function buildHistoryEditOps(
  original: EditableWorkout,
  edited: EditableWorkout,
  weightUnit: string,
  distanceUnit: string,
): HistoryEditOp[] {
  const removals: HistoryEditOp[] = [];
  const changes: HistoryEditOp[] = [];
  const additions: HistoryEditOp[] = [];

  const editedIds = new Set(
    edited.exercises.map((exercise) => exercise.completed_exercise_id),
  );
  for (const exercise of original.exercises) {
    if (!editedIds.has(exercise.completed_exercise_id)) {
      removals.push({
        kind: "removeExercise",
        completedExerciseId: exercise.completed_exercise_id,
      });
    }
  }

  const originalById = new Map(
    original.exercises.map((exercise) => [
      exercise.completed_exercise_id,
      exercise,
    ]),
  );

  for (const exercise of edited.exercises) {
    const before = originalById.get(exercise.completed_exercise_id);
    if (!before || isUnsavedId(exercise.completed_exercise_id)) {
      additions.push({
        kind: "addExercise",
        exerciseId: exercise.exercise_id,
        trackingType: exercise.exercise_tracking_type,
        sets: exercise.sets.map((set) => newSet(set, weightUnit, distanceUnit)),
      });
      continue;
    }

    if (
      before.exercise_id !== exercise.exercise_id ||
      before.exercise_tracking_type !== exercise.exercise_tracking_type
    ) {
      changes.push({
        kind: "replaceExercise",
        completedExerciseId: exercise.completed_exercise_id,
        exerciseId: exercise.exercise_id,
        trackingType: exercise.exercise_tracking_type,
      });
    }

    const keptSetIds = new Set(exercise.sets.map((set) => set.set_id));
    for (const set of before.sets) {
      if (!keptSetIds.has(set.set_id)) {
        removals.push({ kind: "removeSet", setId: set.set_id });
      }
    }

    const beforeSets = new Map(before.sets.map((set) => [set.set_id, set]));
    for (const set of exercise.sets) {
      const previous = beforeSets.get(set.set_id);
      if (!previous || isUnsavedId(set.set_id)) {
        additions.push({
          kind: "addSet",
          completedExerciseId: exercise.completed_exercise_id,
          set: newSet(set, weightUnit, distanceUnit),
        });
        continue;
      }

      const values: Partial<StoredSetValues> = {};
      for (const field of SET_FIELDS) {
        if ((previous[field] ?? null) !== (set[field] ?? null)) {
          values[field] = toStored(
            field,
            set[field] ?? null,
            weightUnit,
            distanceUnit,
          );
        }
      }
      if (Object.keys(values).length > 0) {
        changes.push({ kind: "setValues", setId: set.set_id, values });
      }

      const flags = flagsOf(set);
      const previousFlags = flagsOf(previous);
      if (
        flags.isWarmup !== previousFlags.isWarmup ||
        flags.isDropSet !== previousFlags.isDropSet ||
        flags.isToFailure !== previousFlags.isToFailure
      ) {
        changes.push({ kind: "setFlags", setId: set.set_id, ...flags });
      }

      if (!sameNote(previous.note, set.note)) {
        changes.push({
          kind: "setNote",
          setId: set.set_id,
          note: set.note ?? null,
        });
      }
    }
  }

  const meta: Extract<HistoryEditOp, { kind: "workoutMeta" }> = {
    kind: "workoutMeta",
  };
  if (edited.completedAt.getTime() !== original.completedAt.getTime()) {
    meta.completedAt = edited.completedAt;
  }
  if (edited.durationSeconds !== original.durationSeconds) {
    meta.durationSeconds = edited.durationSeconds;
  }
  if (!sameNote(original.notes, edited.notes)) {
    meta.notes = edited.notes;
  }
  if (Object.keys(meta).length > 1) changes.push(meta);

  return [...removals, ...changes, ...additions];
}

/** "H:MM", the value TimeInput holds in its hours and minutes mode. */
export const clockText = (totalMinutes: number): string =>
  `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;

/** Minutes in a "H:MM" value, or null when it is not one. */
export const parseClockMinutes = (text: string): number | null => {
  const match = /^(\d+):(\d{1,2})$/.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  return Number(match[1]) * 60 + minutes;
};

/** The local moment at `minutesOfDay` on the training day `localDate`. */
export const composeLocalMoment = (
  localDate: string,
  minutesOfDay: number,
): Date => {
  const moment = localDateKeyToDate(localDate);
  moment.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  return moment;
};

/**
 * A workout logged after the fact, in the shape the live session saves, so
 * both are written by saveCompletedWorkout.
 */
export function toSavedWorkout(
  edited: EditableWorkout,
  source: { planId: number | null; workoutId: number | null } | null,
  weightUnit: string,
  distanceUnit: string,
): SavedWorkout {
  const exercises = edited.exercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    resolved_tracking_type: exercise.exercise_tracking_type,
    sets: exercise.sets.map((set, index) => {
      const { values, flags, note } = newSet(set, weightUnit, distanceUnit);
      return {
        set_number: index + 1,
        ...values,
        is_warmup: flags.isWarmup,
        is_drop_set: flags.isDropSet,
        is_to_failure: flags.isToFailure,
        note,
      };
    }),
  }));
  return {
    planId: source?.planId ?? null,
    workoutId: source?.workoutId ?? null,
    duration: edited.durationSeconds,
    totalSetsCompleted: exercises.reduce((n, e) => n + e.sets.length, 0),
    completedAt: edited.completedAt,
    notes: edited.notes,
    exercises,
  };
}
