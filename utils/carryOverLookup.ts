import {
  matchSessionInstance,
  type RowIdentity,
} from "@/utils/exerciseInstance";

export interface CarryOverSet {
  set_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: boolean;
  note?: string | null;
}

export interface CarryOverExercise {
  exercise_id: number;
  sets: CarryOverSet[];
  /** The training day of the session it came from, "YYYY-MM-DD". */
  local_date?: string;
  /** The session note of the workout it came from. */
  workout_notes?: string | null;
  /** The plan row it was logged from; null for older sessions. */
  user_workout_exercise_id?: number | null;
  /** Which past session it came from, 0 for the most recent. */
  session?: number;
}

export interface CarryOverWorkout {
  local_date?: string;
  notes?: string | null;
  exercises: CarryOverExercise[];
}

/** A carried-over set, the training day it was logged on and its session note. */
export type CarryOverMatch = CarryOverSet & {
  local_date?: string;
  workout_notes?: string | null;
};

export function buildExerciseMap(
  data: CarryOverWorkout[] | null,
): Map<number, CarryOverExercise[]> {
  const map = new Map<number, CarryOverExercise[]>();
  if (!data) return map;
  data.forEach((w, session) => {
    for (const ex of w.exercises) {
      const arr = map.get(ex.exercise_id) ?? [];
      arr.push({
        ...ex,
        local_date: w.local_date,
        workout_notes: w.notes,
        session,
      });
      map.set(ex.exercise_id, arr);
    }
  });
  return map;
}

// One entry per past session for a workout row: that session's matching
// block (see matchSessionInstance). Without a row, the first block.
function forRow(
  exercises: CarryOverExercise[],
  row: RowIdentity | undefined,
): CarryOverExercise[] {
  const sessions = new Map<number, CarryOverExercise[]>();
  for (const ex of exercises) {
    const key = ex.session ?? 0;
    sessions.set(key, [...(sessions.get(key) ?? []), ex]);
  }
  const picked: CarryOverExercise[] = [];
  for (const instances of sessions.values()) {
    const match = row ? matchSessionInstance(instances, row) : instances[0];
    if (match) picked.push(match);
  }
  return picked;
}

// Finds the set to carry weight/reps/etc. over from. Prefers the set at the
// same ordinal (e.g. "3rd working set") in the most recent prior session that
// has any sets of the matching type, falling back to that session's last set
// of that type if the current session added more sets than the prior one had.
function lookup(
  map: Map<number, CarryOverExercise[]>,
  exerciseId: number,
  isWarmup: boolean,
  ordinal: number,
  row: RowIdentity | undefined,
): CarryOverMatch | null {
  const exercises = map.get(exerciseId);
  if (!exercises) return null;
  for (const ex of forRow(exercises, row)) {
    const setsOfType = ex.sets.filter((s) => s.is_warmup === isWarmup);
    if (setsOfType.length === 0) continue;
    const set = setsOfType[ordinal] ?? setsOfType[setsOfType.length - 1];
    return {
      ...set,
      local_date: ex.local_date,
      workout_notes: ex.workout_notes,
    };
  }
  return null;
}

// When an exercise was swapped in the previous session, its exercise_id is
// updated in completed_exercises to the replacement's id, so the id-keyed
// lookup above finds nothing. Fall back to positional lookup: use the
// exercise at the same slot index in the most-recent previous workout.
function lookupByPosition(
  previousWorkoutData: CarryOverWorkout[] | null,
  exerciseId: number,
  isWarmup: boolean,
  ordinal: number,
  exercisePosition?: number,
): CarryOverMatch | null {
  if (exercisePosition === undefined) return null;
  const previous = previousWorkoutData?.[0];
  const prevExAtPos = previous?.exercises[exercisePosition];
  if (!previous || !prevExAtPos) return null;
  // The same exercise there is another block of it (this one was skipped),
  // not a swap: the id lookup already had its chance.
  if (prevExAtPos.exercise_id === exerciseId) return null;
  const setsOfType = prevExAtPos.sets.filter((s) => s.is_warmup === isWarmup);
  if (setsOfType.length === 0) return null;
  const set = setsOfType[ordinal] ?? setsOfType[setsOfType.length - 1];
  return {
    ...set,
    local_date: previous.local_date,
    workout_notes: previous.notes,
  };
}

export function findLastAvailableSetData(params: {
  exerciseId: number;
  isWarmup: boolean;
  ordinal: number;
  exercisePosition?: number;
  /** The workout row being filled, so each block of a repeated exercise
   * matches its own block in past sessions. */
  row?: RowIdentity;
  previousWorkoutData: CarryOverWorkout[] | null;
  prevExercisesByExerciseId: Map<number, CarryOverExercise[]>;
  globalExercisesByExerciseId: Map<number, CarryOverExercise[]>;
  alwaysUseGlobalHistory: boolean;
}): CarryOverMatch | null {
  const {
    exerciseId,
    isWarmup,
    ordinal,
    exercisePosition,
    row,
    previousWorkoutData,
    prevExercisesByExerciseId,
    globalExercisesByExerciseId,
    alwaysUseGlobalHistory,
  } = params;
  const find = (map: Map<number, CarryOverExercise[]>) =>
    lookup(map, exerciseId, isWarmup, ordinal, row);

  if (alwaysUseGlobalHistory) {
    return find(globalExercisesByExerciseId);
  }

  return (
    find(prevExercisesByExerciseId) ??
    lookupByPosition(
      previousWorkoutData,
      exerciseId,
      isWarmup,
      ordinal,
      exercisePosition,
    ) ??
    find(globalExercisesByExerciseId)
  );
}
