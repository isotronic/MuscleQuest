import { formatGroupedInteger } from "@/utils/numberFormat";

/**
 * Which instance of its exercise the row at `index` is: 0 for the first time
 * the exercise appears in the workout, 1 for the second, and so on.
 */
export function occurrenceIndex(
  exercises: readonly { exercise_id: number }[],
  index: number,
): number {
  const id = exercises[index]?.exercise_id;
  return exercises.slice(0, index).filter((e) => e.exercise_id === id).length;
}

/** The name, with "(2)", "(3)" ... for a repeat (occurrence 1, 2 ...). */
function numbered(name: string, occurrence: number): string {
  return occurrence === 0
    ? name
    : `${name} (${formatGroupedInteger(occurrence + 1)})`;
}

/**
 * The row's exercise name, with "(2)", "(3)" ... after a repeat of an
 * exercise already in the workout, so two blocks of squats can be told apart.
 */
export function instanceName(
  exercises: readonly { exercise_id: number }[],
  index: number,
  name: string,
): string {
  return numbered(name, occurrenceIndex(exercises, index));
}

/**
 * instanceName for a logged session: numbered by the plan block it was
 * logged from when known, so a back-off block logged alone still reads
 * "Squat (2)"; by its order in the session otherwise.
 */
export function loggedInstanceName(
  exercises: readonly {
    exercise_id: number;
    plan_occurrence?: number | null;
  }[],
  index: number,
  name: string,
): string {
  return numbered(
    name,
    exercises[index]?.plan_occurrence ?? occurrenceIndex(exercises, index),
  );
}

/** A workout row as matching against past sessions needs it. */
export interface WorkoutRow {
  exercise_id: number;
  /** The plan row id (user_workout_exercises.id), when it has one. */
  id?: number | null;
}

/** A logged exercise as matching needs it. */
export interface LoggedInstance {
  exercise_id: number;
  /** The plan row it was logged from; null for older sessions. */
  user_workout_exercise_id?: number | null;
}

/** Who the row at `index` is, for matching it against past sessions. */
export interface RowIdentity {
  exerciseId: number;
  rowId: number | null;
  /** Plan row ids of the other blocks of the same exercise. */
  siblingRowIds: Set<number>;
  occurrence: number;
}

export function rowIdentity(
  exercises: readonly WorkoutRow[],
  index: number,
): RowIdentity {
  const row = exercises[index];
  const siblingRowIds = new Set<number>();
  exercises.forEach((e, i) => {
    if (i !== index && e.exercise_id === row?.exercise_id && e.id != null) {
      siblingRowIds.add(e.id);
    }
  });
  return {
    exerciseId: row?.exercise_id ?? 0,
    rowId: row?.id ?? null,
    siblingRowIds,
    occurrence: occurrenceIndex(exercises, index),
  };
}

/**
 * The block of one past session that matches a workout row: the one logged
 * from the same plan row; none when the session only logged other blocks of
 * the exercise (a skipped block must not take a sibling's sets); otherwise,
 * for older sessions or a plan changed since, the n-th instance, or the first
 * when the session had fewer.
 */
export function matchSessionInstance<E extends LoggedInstance>(
  sessionExercises: readonly E[],
  row: RowIdentity,
): E | undefined {
  const instances = sessionExercises.filter(
    (e) => e.exercise_id === row.exerciseId,
  );
  if (row.rowId != null) {
    const own = instances.find((e) => e.user_workout_exercise_id === row.rowId);
    if (own) return own;
  }
  const loggedAsSibling = instances.some(
    (e) =>
      e.user_workout_exercise_id != null &&
      row.siblingRowIds.has(e.user_workout_exercise_id),
  );
  if (loggedAsSibling) return undefined;
  return instances[row.occurrence] ?? instances[0];
}
