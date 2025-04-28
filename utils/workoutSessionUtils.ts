// Define the CompletedWorkout type
export interface CompletedWorkout {
  id: number;
  workout_id: number;
  plan_id: number;
  workout_name: string;
  date_completed: string;
  duration: number;
  total_sets_completed: number;
  exercises: {
    exercise_id: number;
    exercise_name: string;
    exercise_image?: number[];
    exercise_tracking_type: string;
    sets: {
      set_id: number;
      set_number: number;
      weight: number | null;
      reps: number | null;
      time: number | null;
    }[];
  }[];
}

// Define types for exercise and set
export type ExerciseSet = {
  restMinutes: number;
  restSeconds: number;
  repsMin?: number;
  repsMax?: number;
  time?: number;
  isWarmup?: boolean;
  isDropSet?: boolean;
  isToFailure?: boolean;
};

export type Exercise = {
  exercise_id: number;
  name: string;
  sets: ExerciseSet[];
  tracking_type?: string;
  animated_url?: string;
  local_animated_uri?: string;
};

export type SetData = {
  weight?: string;
  reps?: string;
  time?: string;
};

/**
 * Computes the indices for the next set
 */
export const computeNextIndices = (
  workout: { exercises: Exercise[] } | null | undefined,
  currentExerciseIndex: number,
  currentSetIndex: number,
) => {
  let nextExerciseIndex = currentExerciseIndex;
  let nextSetIndex = currentSetIndex + 1;

  const currentExercise = workout?.exercises[currentExerciseIndex];
  if (currentExercise && nextSetIndex >= currentExercise.sets.length) {
    // Move to first set of next exercise
    nextExerciseIndex = currentExerciseIndex + 1;
    nextSetIndex = 0;
  }

  let hasNextSet = false;
  if (
    workout &&
    nextExerciseIndex < workout.exercises.length &&
    workout.exercises[nextExerciseIndex]?.sets[nextSetIndex]
  ) {
    hasNextSet = true;
  }

  return { nextExerciseIndex, nextSetIndex, hasNextSet };
};

/**
 * Computes the indices for the previous set
 */
export const computePreviousIndices = (
  workout: { exercises: Exercise[] } | null | undefined,
  currentExerciseIndex: number,
  currentSetIndex: number,
) => {
  let previousExerciseIndex: number | null = currentExerciseIndex;
  let previousSetIndex: number | null = currentSetIndex - 1;

  if (previousSetIndex < 0) {
    // Move to last set of previous exercise
    previousExerciseIndex = currentExerciseIndex - 1;
    if (previousExerciseIndex >= 0) {
      const prevExercise = workout?.exercises[previousExerciseIndex];
      previousSetIndex = prevExercise?.sets.length
        ? prevExercise.sets.length - 1
        : 0;
    } else {
      previousSetIndex = null;
      previousExerciseIndex = null;
    }
  }

  let hasPreviousSet = false;
  if (
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    previousExerciseIndex >= 0 &&
    previousSetIndex >= 0 &&
    workout &&
    workout.exercises[previousExerciseIndex]?.sets[previousSetIndex]
  ) {
    hasPreviousSet = true;
  }

  return { previousExerciseIndex, previousSetIndex, hasPreviousSet };
};

/**
 * Checks if a set is the first or last in the workout
 */
export const checkSetPosition = (
  workout: { exercises: Exercise[] } | null | undefined,
  exerciseIndex: number | null,
  setIndex: number | null,
  exercise: Exercise | null | undefined,
) => {
  if (!workout || exerciseIndex === null || setIndex === null || !exercise) {
    return { isFirst: false, isLast: false };
  }

  const isFirst = exerciseIndex === 0 && setIndex === 0;
  const isLast =
    exerciseIndex === workout.exercises.length - 1 &&
    setIndex === exercise.sets.length - 1;

  return { isFirst, isLast };
};

/**
 * Finds the last available set data from previous workouts
 */
export const findSetDataFromPreviousWorkouts = (
  previousWorkoutData: CompletedWorkout[] | null | undefined,
  exerciseId: number,
  setIndex: number,
) => {
  if (!previousWorkoutData) {
    return null;
  }

  for (const workout of previousWorkoutData) {
    const exerciseData = workout.exercises.find(
      (prevEx) => prevEx.exercise_id === exerciseId,
    );

    if (exerciseData && exerciseData.sets[setIndex]) {
      return exerciseData.sets[setIndex]; // Return the first non-null data found
    }
  }

  return null; // No data found in any past workout
};

/**
 * Gets weight/reps/time values with fallbacks
 */
export const getSetValues = (
  weightAndReps: any,
  exerciseIndex: number | null,
  setIndex: number | null,
  previousSetData: any,
) => {
  if (exerciseIndex === null || setIndex === null) {
    return { weight: "", reps: "", time: "" };
  }

  const weight =
    weightAndReps[exerciseIndex]?.[setIndex]?.weight ??
    previousSetData?.weight?.toString() ??
    "";

  const reps =
    weightAndReps[exerciseIndex]?.[setIndex]?.reps ??
    previousSetData?.reps?.toString() ??
    "";

  const time =
    weightAndReps[exerciseIndex]?.[setIndex]?.time ??
    previousSetData?.time?.toString() ??
    "";

  return { weight, reps, time };
};
