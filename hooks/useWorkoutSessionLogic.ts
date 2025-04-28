import { useEffect } from "react";
import { Alert } from "react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { convertTimeStrToSeconds } from "@/utils/utility";

// Helper functions for workout session logic

/**
 * Computes the indices for the next set
 */
const computeNextIndices = (
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

  const hasNextSet =
    workout &&
    nextExerciseIndex < workout.exercises.length &&
    workout.exercises[nextExerciseIndex]?.sets[nextSetIndex];

  return { nextExerciseIndex, nextSetIndex, hasNextSet };
};

/**
 * Computes the indices for the previous set
 */
const computePreviousIndices = (
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

  const hasPreviousSet =
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    previousExerciseIndex >= 0 &&
    previousSetIndex >= 0 &&
    workout &&
    workout.exercises[previousExerciseIndex]?.sets[previousSetIndex];

  return { previousExerciseIndex, previousSetIndex, hasPreviousSet };
};

/**
 * Checks if a set is the first or last in the workout
 */
const checkSetPosition = (
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
const findSetDataFromPreviousWorkouts = (
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
const getSetValues = (
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

type SetData = {
  weight?: string;
  reps?: string;
  time?: string;
};

// Define types for exercise and set
type ExerciseSet = {
  restMinutes: number;
  restSeconds: number;
  repsMin?: number;
  repsMax?: number;
  time?: number;
  isWarmup?: boolean;
  isDropSet?: boolean;
  isToFailure?: boolean;
};

type Exercise = {
  exercise_id: number;
  name: string;
  sets: ExerciseSet[];
  tracking_type?: string;
  animated_url?: string;
  local_animated_uri?: string;
};

type WorkoutSessionLogicResult = {
  // Current set data
  currentExercise: Exercise | undefined;
  currentSetIndex: number;
  currentSet: ExerciseSet | undefined;
  currentSetCompleted: boolean;
  weight: string;
  reps: string;
  time: string;

  // Next set data
  hasNextSet: boolean;
  nextExerciseIndex: number;
  nextSetIndex: number;
  nextExercise: Exercise | null;
  upcomingSet: ExerciseSet | null;
  nextExerciseName: string;
  nextWeight: string;
  nextReps: string;
  nextTime: string;
  nextIsLastSetOfLastExercise: boolean;
  nextIsFirstSetOfFirstExercise: boolean;

  // Previous set data
  hasPreviousSet: boolean;
  previousExerciseIndex: number | null;
  previousSetIndex: number | null;
  previousExercise: Exercise | null;
  previousSet: ExerciseSet | null;
  previousExerciseName: string;
  previousWeight: string;
  previousReps: string;
  previousTime: string;
  previousSetCompleted: boolean;
  previousIsLastSetOfLastExercise: boolean;
  previousIsFirstSetOfFirstExercise: boolean;

  // Position indicators
  currentIsLastSetOfLastExercise: boolean;
  currentIsFirstSetOfFirstExercise: boolean;

  // Actions
  handleWeightInputChange: (inputValue: string) => void;
  handleRepsInputChange: (inputValue: string) => void;
  handleTimeInputChange: (inputValue: string) => void;
  handleWeightChange: (amount: number) => void;
  handleRepsChange: (amount: number) => void;
  handleRemoveSet: (index: number) => void;
  handleCompleteSet: () => void;
  getNextSetData: () => SetData;
  setCurrentExerciseAndSetIndex: (
    exerciseIndex: number,
    setIndex: number,
  ) => void;
};

export const useWorkoutSessionLogic = (
  selectedExerciseIndexParam: string | string[] | undefined,
  workoutHistoryParam: string | string[] | undefined,
): WorkoutSessionLogicResult => {
  const {
    workout,
    currentExerciseIndex,
    currentSetIndices,
    weightAndReps,
    previousWorkoutData,
    completedSets,
    setCurrentExerciseIndex,
    setCurrentSetIndex,
    updateWeightAndReps,
    initializeWeightAndReps,
    nextSet,
    removeSet,
  } = useActiveWorkoutStore();

  // We don't need to track nextSetData state in this hook as it's handled in the component

  // Initialize workout history data
  useEffect(() => {
    if (workoutHistoryParam) {
      const previousWorkoutData: CompletedWorkout[] = JSON.parse(
        workoutHistoryParam as string,
      );
      initializeWeightAndReps(previousWorkoutData);
    }
  }, [workoutHistoryParam, initializeWeightAndReps]);

  // Set initial exercise index
  useEffect(() => {
    if (workout && selectedExerciseIndexParam !== undefined) {
      setCurrentExerciseIndex(Number(selectedExerciseIndexParam));
    }
  }, [selectedExerciseIndexParam, setCurrentExerciseIndex, workout]);

  // Current set data
  const currentExercise = workout?.exercises[currentExerciseIndex];
  const currentSetIndex = currentSetIndices[currentExerciseIndex] || 0;
  const currentSet = currentExercise?.sets[currentSetIndex];
  const currentSetCompleted =
    completedSets[currentExerciseIndex] &&
    typeof completedSets[currentExerciseIndex][currentSetIndex] === "boolean"
      ? completedSets[currentExerciseIndex][currentSetIndex]
      : false;

  // Get current set data from previous workouts
  const previousWorkoutSetData = findSetDataFromPreviousWorkouts(
    previousWorkoutData,
    currentExercise?.exercise_id || 0,
    currentSetIndex,
  );

  // Get current set values
  const { weight, reps, time } = getSetValues(
    weightAndReps,
    currentExerciseIndex,
    currentSetIndex,
    previousWorkoutSetData,
  );

  // Compute next and previous indices
  const { nextExerciseIndex, nextSetIndex, hasNextSet } = computeNextIndices(
    workout,
    currentExerciseIndex,
    currentSetIndex,
  );

  const { previousExerciseIndex, previousSetIndex, hasPreviousSet } =
    computePreviousIndices(workout, currentExerciseIndex, currentSetIndex);

  // Next set data
  const nextExercise = hasNextSet
    ? workout!.exercises[nextExerciseIndex]
    : null;
  const upcomingSet = nextExercise ? nextExercise.sets[nextSetIndex] : null;
  const nextExerciseName = nextExercise?.name || "";

  // Get next set data from previous workouts
  const previousWorkoutNextSetData = findSetDataFromPreviousWorkouts(
    previousWorkoutData,
    nextExercise?.exercise_id || 0,
    nextSetIndex,
  );

  // Get next set values
  const {
    weight: nextWeight,
    reps: nextReps,
    time: nextTime,
  } = getSetValues(
    weightAndReps,
    nextExerciseIndex,
    nextSetIndex,
    previousWorkoutNextSetData,
  );

  // Previous set data
  const previousExercise =
    hasPreviousSet && previousExerciseIndex !== null
      ? workout!.exercises[previousExerciseIndex]
      : null;
  const previousSet =
    previousExercise && previousSetIndex !== null
      ? previousExercise.sets[previousSetIndex]
      : null;
  const previousExerciseName = previousExercise?.name || "";

  // Get previous set data from previous workouts
  const previousSetData =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? findSetDataFromPreviousWorkouts(
          previousWorkoutData,
          previousExercise?.exercise_id || 0,
          previousSetIndex,
        )
      : null;

  // Get previous set values
  const {
    weight: previousWeight,
    reps: previousReps,
    time: previousTime,
  } = getSetValues(
    weightAndReps,
    previousExerciseIndex,
    previousSetIndex,
    previousSetData,
  );

  const previousSetCompleted =
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    completedSets[previousExerciseIndex] &&
    typeof completedSets[previousExerciseIndex][previousSetIndex] === "boolean"
      ? completedSets[previousExerciseIndex][previousSetIndex]
      : false;

  // Check position indicators
  const {
    isFirst: currentIsFirstSetOfFirstExercise,
    isLast: currentIsLastSetOfLastExercise,
  } = checkSetPosition(
    workout,
    currentExerciseIndex,
    currentSetIndex,
    currentExercise,
  );

  const {
    isFirst: nextIsFirstSetOfFirstExercise,
    isLast: nextIsLastSetOfLastExercise,
  } = checkSetPosition(workout, nextExerciseIndex, nextSetIndex, nextExercise);

  const {
    isFirst: previousIsFirstSetOfFirstExercise,
    isLast: previousIsLastSetOfLastExercise,
  } = checkSetPosition(
    workout,
    previousExerciseIndex,
    previousSetIndex,
    previousExercise,
  );

  const handleWeightInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      sanitizedInput,
      reps,
      time,
    );
  };

  const handleRepsInputChange = (inputValue: string) => {
    const sanitizedInput = inputValue.replace(/[^0-9.]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      sanitizedInput,
      time,
    );
  };

  const handleTimeInputChange = (inputValue: string) => {
    // Remove any non-digits first
    const sanitizedInput = inputValue.replace(/[^0-9]/g, "");
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      reps,
      sanitizedInput,
    );
  };

  const handleWeightChange = (amount: number) => {
    const currentWeight = isNaN(parseFloat(weight)) ? 0 : parseFloat(weight);
    const newWeight = (currentWeight + amount).toFixed(1);
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      newWeight,
      reps,
      time,
    );
  };

  const handleRepsChange = (amount: number) => {
    const currentReps = isNaN(parseInt(reps)) ? 0 : parseInt(reps);
    const newReps = (currentReps + amount).toString();
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      weight,
      newReps,
      time,
    );
  };

  const handleRemoveSet = (index: number) => {
    Alert.alert("Delete Set", "Are you sure you want to delete this set?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeSet(index);
        },
      },
    ]);
  };

  /**
   * Gets data for the next set with logic for carrying over values
   */
  const getNextSetData = () => {
    // Compute temporary next indices
    const {
      nextExerciseIndex: tempNextExerciseIndex,
      nextSetIndex: tempNextSetIndex,
      hasNextSet: tempHasNextSet,
    } = computeNextIndices(workout, currentExerciseIndex, currentSetIndex);

    if (tempHasNextSet) {
      const nextExercise = workout!.exercises[tempNextExerciseIndex];
      const previousWorkoutNextSetData = findSetDataFromPreviousWorkouts(
        previousWorkoutData,
        nextExercise.exercise_id,
        tempNextSetIndex,
      );

      // Logic to carry over weight/reps from current set
      const currentSetValues =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex] || {};

      const { isWarmup, isDropSet } =
        workout!.exercises[currentExerciseIndex].sets[currentSetIndex];

      const isNextDropSet =
        workout!.exercises[currentExerciseIndex].sets[tempNextSetIndex]
          ?.isDropSet;

      const nextSetValues = {
        weight:
          (isWarmup || isDropSet || isNextDropSet) &&
          previousWorkoutNextSetData?.weight
            ? previousWorkoutNextSetData?.weight?.toString()
            : currentSetValues.weight || "",
        reps: previousWorkoutNextSetData?.reps?.toString() || "",
        time: previousWorkoutNextSetData?.time
          ? // Convert stored seconds back to display format (e.g., 360 -> "600")
            previousWorkoutNextSetData.time.toString().padStart(2, "0")
          : "",
      };

      return {
        weight: nextSetValues.weight,
        reps: nextSetValues.reps,
        time: nextSetValues.time,
      };
    } else {
      return {};
    }
  };

  /**
   * Handles completing the current set
   */
  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Parse weight and reps, treating empty strings as zero
    const weightInKg = parseFloat(weight);
    const validWeightInKg = isNaN(weightInKg) ? 0 : weightInKg;

    const repsNum = parseInt(reps);
    const validRepsNum = isNaN(repsNum) ? 0 : repsNum;

    // Convert time from MM:SS format to total seconds
    const validTimeNum = convertTimeStrToSeconds(time);

    // Update the weightAndReps with valid values for the current set
    updateWeightAndReps(
      currentExerciseIndex,
      currentSetIndex,
      validWeightInKg.toString(),
      validRepsNum.toString(),
      validTimeNum.toString(), // Store as seconds
    );

    // Call nextSet to mark the current set as completed and move to the next set
    nextSet();
  };

  const setCurrentExerciseAndSetIndex = (
    exerciseIndex: number,
    setIndex: number,
  ) => {
    setCurrentExerciseIndex(exerciseIndex);
    setCurrentSetIndex(exerciseIndex, setIndex);
  };

  // Fix boolean type issues by ensuring all boolean values are actually booleans
  const safeHasNextSet = !!hasNextSet;
  const safeNextIsLastSetOfLastExercise = !!nextIsLastSetOfLastExercise;
  const safeNextIsFirstSetOfFirstExercise = !!nextIsFirstSetOfFirstExercise;
  const safeHasPreviousSet = !!hasPreviousSet;
  const safePreviousIsLastSetOfLastExercise = !!previousIsLastSetOfLastExercise;
  const safePreviousIsFirstSetOfFirstExercise =
    !!previousIsFirstSetOfFirstExercise;
  const safeCurrentIsLastSetOfLastExercise = !!currentIsLastSetOfLastExercise;
  const safeCurrentIsFirstSetOfFirstExercise =
    !!currentIsFirstSetOfFirstExercise;

  return {
    // Current set data
    currentExercise,
    currentSetIndex,
    currentSet,
    currentSetCompleted,
    weight,
    reps,
    time,

    // Next set data
    hasNextSet: safeHasNextSet,
    nextExerciseIndex,
    nextSetIndex,
    nextExercise,
    upcomingSet,
    nextExerciseName,
    nextWeight,
    nextReps,
    nextTime,
    nextIsLastSetOfLastExercise: safeNextIsLastSetOfLastExercise,
    nextIsFirstSetOfFirstExercise: safeNextIsFirstSetOfFirstExercise,

    // Previous set data
    hasPreviousSet: safeHasPreviousSet,
    previousExerciseIndex,
    previousSetIndex,
    previousExercise,
    previousSet,
    previousExerciseName,
    previousWeight,
    previousReps,
    previousTime,
    previousSetCompleted,
    previousIsLastSetOfLastExercise: safePreviousIsLastSetOfLastExercise,
    previousIsFirstSetOfFirstExercise: safePreviousIsFirstSetOfFirstExercise,

    // Position indicators
    currentIsLastSetOfLastExercise: safeCurrentIsLastSetOfLastExercise,
    currentIsFirstSetOfFirstExercise: safeCurrentIsFirstSetOfFirstExercise,

    // Actions
    handleWeightInputChange,
    handleRepsInputChange,
    handleTimeInputChange,
    handleWeightChange,
    handleRepsChange,
    handleRemoveSet,
    handleCompleteSet,
    getNextSetData,
    setCurrentExerciseAndSetIndex,
  };
};
