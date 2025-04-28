import { useEffect } from "react";
import { Alert } from "react-native";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { convertTimeStrToSeconds } from "@/utils/utility";

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

  const findLastAvailableSetData = (exerciseId: number, setIndex: number) => {
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

  const previousWorkoutSetData = findLastAvailableSetData(
    currentExercise?.exercise_id || 0,
    currentSetIndex,
  );

  const weight =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight ??
    previousWorkoutSetData?.weight?.toString() ??
    "";

  const reps =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps ??
    previousWorkoutSetData?.reps?.toString() ??
    "";

  const time =
    weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.time ??
    previousWorkoutSetData?.time?.toString() ??
    "";

  // Compute next set index and exercise index
  let nextExerciseIndex = currentExerciseIndex;
  let nextSetIndex = currentSetIndex + 1;

  if (currentExercise && nextSetIndex >= currentExercise.sets.length) {
    // Move to first set of next exercise
    nextExerciseIndex = currentExerciseIndex + 1;
    nextSetIndex = 0;
  }

  const hasNextSet =
    workout &&
    nextExerciseIndex < workout.exercises.length &&
    workout.exercises[nextExerciseIndex].sets[nextSetIndex];

  // Compute previous set index and exercise index
  let previousExerciseIndex: number | null = currentExerciseIndex;
  let previousSetIndex: number | null = currentSetIndex - 1;

  if (previousSetIndex < 0) {
    // Move to last set of previous exercise
    previousExerciseIndex = currentExerciseIndex - 1;
    if (previousExerciseIndex >= 0) {
      const prevExercise = workout?.exercises[previousExerciseIndex];
      previousSetIndex = prevExercise!.sets.length - 1;
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
    workout.exercises[previousExerciseIndex].sets[previousSetIndex];

  // Next set data
  const nextExercise = hasNextSet ? workout.exercises[nextExerciseIndex] : null;
  const upcomingSet = nextExercise ? nextExercise.sets[nextSetIndex] : null;
  const nextExerciseName = nextExercise?.name || "";

  const previousWorkoutNextSetData = findLastAvailableSetData(
    nextExercise?.exercise_id || 0,
    nextSetIndex,
  );

  const nextWeight =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.weight ??
    previousWorkoutNextSetData?.weight?.toString() ??
    "";

  const nextReps =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.reps ??
    previousWorkoutNextSetData?.reps?.toString() ??
    "";

  const nextTime =
    weightAndReps[nextExerciseIndex]?.[nextSetIndex]?.time ??
    previousWorkoutNextSetData?.time?.toString() ??
    "";

  // Previous set data
  const previousExercise =
    hasPreviousSet && previousExerciseIndex !== null
      ? workout.exercises[previousExerciseIndex]
      : null;
  const previousSet =
    previousExercise && previousSetIndex !== null
      ? previousExercise.sets[previousSetIndex]
      : null;
  const previousExerciseName = previousExercise?.name || "";

  const previousExerciseData = previousWorkoutData
    ?.map((workout) => workout.exercises)
    .flat()
    .find((prevEx) => prevEx.exercise_id === previousExercise?.exercise_id);

  let previousSetData = null;

  if (previousSetIndex !== null && previousExerciseData) {
    previousSetData = previousExerciseData.sets[previousSetIndex];
  }

  const previousWeight =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.weight ??
        previousSetData?.weight?.toString() ??
        ""
      : "";

  const previousReps =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.reps ??
        previousSetData?.reps?.toString() ??
        ""
      : "";

  const previousTime =
    previousExerciseIndex !== null && previousSetIndex !== null
      ? weightAndReps[previousExerciseIndex]?.[previousSetIndex]?.time ??
        previousSetData?.time?.toString() ??
        ""
      : "";

  const previousSetCompleted =
    previousExerciseIndex !== null &&
    previousSetIndex !== null &&
    completedSets[previousExerciseIndex] &&
    typeof completedSets[previousExerciseIndex][previousSetIndex] === "boolean"
      ? completedSets[previousExerciseIndex][previousSetIndex]
      : false;

  const currentIsLastSetOfLastExercise =
    workout &&
    currentExercise &&
    currentExerciseIndex === workout.exercises.length - 1 &&
    currentSetIndex === currentExercise.sets.length - 1;

  const currentIsFirstSetOfFirstExercise =
    workout &&
    currentExercise &&
    currentExerciseIndex === 0 &&
    currentSetIndex === 0;

  const nextIsLastSetOfLastExercise =
    workout &&
    nextExercise &&
    nextExerciseIndex === workout.exercises.length - 1 &&
    nextSetIndex === nextExercise.sets.length - 1;

  const nextIsFirstSetOfFirstExercise =
    workout && nextExercise && nextExerciseIndex === 0 && nextSetIndex === 0;

  const previousIsLastSetOfLastExercise =
    workout &&
    previousExercise &&
    previousExerciseIndex === workout.exercises.length - 1 &&
    previousSetIndex === previousExercise.sets.length - 1;

  const previousIsFirstSetOfFirstExercise =
    workout &&
    previousExercise &&
    previousExerciseIndex === 0 &&
    previousSetIndex === 0;

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

  const getNextSetData = () => {
    // Compute temporary next indices
    let tempNextExerciseIndex = currentExerciseIndex;
    let tempNextSetIndex = currentSetIndex + 1;

    if (currentExercise && tempNextSetIndex >= currentExercise.sets.length) {
      tempNextExerciseIndex += 1;
      tempNextSetIndex = 0;
    }

    if (
      workout &&
      tempNextExerciseIndex < workout.exercises.length &&
      workout.exercises[tempNextExerciseIndex].sets[tempNextSetIndex]
    ) {
      const nextExercise = workout.exercises[tempNextExerciseIndex];
      const previousWorkoutNextSetData = previousWorkoutData
        ?.map((workout) => workout.exercises)
        .flat()
        .find((prevEx) => prevEx.exercise_id === nextExercise?.exercise_id)
        ?.sets[tempNextSetIndex];

      // Logic to carry over weight/reps from current set
      const currentSetValues =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex] || {};

      const { isWarmup, isDropSet } =
        workout.exercises[currentExerciseIndex].sets[currentSetIndex];

      const isNextDropSet =
        workout.exercises[currentExerciseIndex].sets[tempNextSetIndex]
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

  const handleCompleteSet = () => {
    if (!currentExercise || !currentSet) {
      return;
    }

    // Parse weight and reps, treating empty strings as zero
    const weightStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight ??
      previousWorkoutSetData?.weight?.toString() ??
      "";
    const repsStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps ??
      previousWorkoutSetData?.reps?.toString() ??
      "";
    const timeStr =
      weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.time ??
      previousWorkoutSetData?.time?.toString() ??
      "";

    const weightInKg = parseFloat(weightStr);
    const validWeightInKg = isNaN(weightInKg) ? 0 : weightInKg;

    const repsNum = parseInt(repsStr);
    const validRepsNum = isNaN(repsNum) ? 0 : repsNum;

    // Convert time from MM:SS format to total seconds
    const validTimeNum = convertTimeStrToSeconds(timeStr);

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
