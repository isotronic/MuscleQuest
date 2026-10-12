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
  /** Which instance of the exercise in its session, 0 for the first. */
  occurrence?: number;
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
  for (const w of data) {
    const seen = new Map<number, number>();
    for (const ex of w.exercises) {
      const arr = map.get(ex.exercise_id) ?? [];
      const occurrence = seen.get(ex.exercise_id) ?? 0;
      seen.set(ex.exercise_id, occurrence + 1);
      arr.push({
        ...ex,
        local_date: w.local_date,
        workout_notes: w.notes,
        occurrence,
      });
      map.set(ex.exercise_id, arr);
    }
  }
  return map;
}

// One entry per session for an exercise's n-th instance in the workout: the
// session's n-th instance, or its first when it had fewer. A session's
// instances sit next to each other in the map, first one first.
function forOccurrence(
  exercises: CarryOverExercise[],
  occurrence: number,
): CarryOverExercise[] {
  const picked: CarryOverExercise[] = [];
  for (const ex of exercises) {
    const n = ex.occurrence ?? 0;
    if (n === 0) picked.push(ex);
    else if (n === occurrence) picked[picked.length - 1] = ex;
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
  occurrence: number,
): CarryOverMatch | null {
  const exercises = map.get(exerciseId);
  if (!exercises) return null;
  for (const ex of forOccurrence(exercises, occurrence)) {
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
  isWarmup: boolean,
  ordinal: number,
  exercisePosition?: number,
): CarryOverMatch | null {
  if (exercisePosition === undefined) return null;
  const previous = previousWorkoutData?.[0];
  const prevExAtPos = previous?.exercises[exercisePosition];
  if (!previous || !prevExAtPos) return null;
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
  /** Which instance of the exercise in the current workout, 0 for the first. */
  occurrence?: number;
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
    occurrence = 0,
    previousWorkoutData,
    prevExercisesByExerciseId,
    globalExercisesByExerciseId,
    alwaysUseGlobalHistory,
  } = params;
  const find = (map: Map<number, CarryOverExercise[]>) =>
    lookup(map, exerciseId, isWarmup, ordinal, occurrence);

  if (alwaysUseGlobalHistory) {
    return find(globalExercisesByExerciseId);
  }

  return (
    find(prevExercisesByExerciseId) ??
    lookupByPosition(
      previousWorkoutData,
      isWarmup,
      ordinal,
      exercisePosition,
    ) ??
    find(globalExercisesByExerciseId)
  );
}
