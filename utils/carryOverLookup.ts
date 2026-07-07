export interface CarryOverSet {
  set_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  is_warmup: boolean;
}

export interface CarryOverExercise {
  exercise_id: number;
  sets: CarryOverSet[];
}

export interface CarryOverWorkout {
  exercises: CarryOverExercise[];
}

export function buildExerciseMap(
  data: CarryOverWorkout[] | null,
): Map<number, CarryOverExercise[]> {
  const map = new Map<number, CarryOverExercise[]>();
  if (!data) return map;
  for (const w of data) {
    for (const ex of w.exercises) {
      const arr = map.get(ex.exercise_id) ?? [];
      arr.push(ex);
      map.set(ex.exercise_id, arr);
    }
  }
  return map;
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
): CarryOverSet | null {
  const exercises = map.get(exerciseId);
  if (!exercises) return null;
  for (const ex of exercises) {
    const setsOfType = ex.sets.filter((s) => s.is_warmup === isWarmup);
    if (setsOfType.length === 0) continue;
    return setsOfType[ordinal] ?? setsOfType[setsOfType.length - 1];
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
): CarryOverSet | null {
  if (exercisePosition === undefined) return null;
  const prevExAtPos = previousWorkoutData?.[0]?.exercises[exercisePosition];
  if (!prevExAtPos) return null;
  const setsOfType = prevExAtPos.sets.filter((s) => s.is_warmup === isWarmup);
  if (setsOfType.length === 0) return null;
  return setsOfType[ordinal] ?? setsOfType[setsOfType.length - 1];
}

export function findLastAvailableSetData(params: {
  exerciseId: number;
  isWarmup: boolean;
  ordinal: number;
  exercisePosition?: number;
  previousWorkoutData: CarryOverWorkout[] | null;
  prevExercisesByExerciseId: Map<number, CarryOverExercise[]>;
  globalExercisesByExerciseId: Map<number, CarryOverExercise[]>;
  alwaysUseGlobalHistory: boolean;
}): CarryOverSet | null {
  const {
    exerciseId,
    isWarmup,
    ordinal,
    exercisePosition,
    previousWorkoutData,
    prevExercisesByExerciseId,
    globalExercisesByExerciseId,
    alwaysUseGlobalHistory,
  } = params;

  if (alwaysUseGlobalHistory) {
    return lookup(globalExercisesByExerciseId, exerciseId, isWarmup, ordinal);
  }

  return (
    lookup(prevExercisesByExerciseId, exerciseId, isWarmup, ordinal) ??
    lookupByPosition(previousWorkoutData, isWarmup, ordinal, exercisePosition) ??
    lookup(globalExercisesByExerciseId, exerciseId, isWarmup, ordinal)
  );
}
