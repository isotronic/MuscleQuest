import { create } from "zustand";
import { Workout } from "./workoutStore";
import { router } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

interface ActiveWorkoutStore {
  activeWorkout: { planId: number; workoutId: number; name: string } | null;
  workout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndices: { [exerciseIndex: number]: number };
  completedSets: {
    [exerciseIndex: number]: { [setIndex: number]: boolean };
  };
  weightAndReps: {
    [exerciseIndex: number]: {
      [setIndex: number]: { weight: string; reps: string };
    };
  };
  startTime: Date | null;
  timerRunning: boolean;
  timerExpiry: Date | null;
  setWorkout: (
    workout: Workout,
    planId: number,
    workoutId: number,
    name: string,
  ) => void;
  nextSet: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetIndex: (exerciseIndex: number, setIndex: number) => void;
  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight: string,
    reps: string,
  ) => void;
  initializeWeightAndReps: (previousWorkoutData: CompletedWorkout) => void;
  resetWorkout: () => void;
  startTimer: (expiry: Date) => void;
  stopTimer: () => void;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>((set, get) => ({
  activeWorkout: null,
  workout: null,
  currentExerciseIndex: 0,
  currentSetIndices: {},
  completedSets: {},
  weightAndReps: {},
  startTime: null,
  timerRunning: false,
  timerExpiry: null,

  setWorkout: (workout, planId, workoutId, name) =>
    set({
      activeWorkout: { planId, workoutId, name },
      workout,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      startTime: new Date(),
      timerRunning: false,
      timerExpiry: null,
    }),

  setCurrentExerciseIndex: (index: number) =>
    set((state) => {
      const { currentSetIndices, completedSets, workout } = state;

      if (!workout) {
        return state;
      }

      const totalSets = workout.exercises[index].sets.length;
      const isExerciseCompleted = completedSets[index]
        ? Object.keys(completedSets[index]).length === totalSets
        : false;

      const currentSetIndex = isExerciseCompleted
        ? 0
        : currentSetIndices[index] || 0;

      return {
        currentExerciseIndex: index,
        currentSetIndices: {
          ...currentSetIndices,
          [index]: currentSetIndex,
        },
      };
    }),

  nextSet: () =>
    set((state) => {
      const {
        workout,
        currentExerciseIndex,
        currentSetIndices,
        weightAndReps,
        completedSets,
      } = state;

      if (!workout) {
        return state;
      }

      const currentExercise = workout.exercises[currentExerciseIndex];
      const currentSetIndex = currentSetIndices[currentExerciseIndex] || 0;
      const nextSetIndex = currentSetIndex + 1;

      // Mark current set as completed
      const updatedCompletedSets = {
        ...completedSets,
        [currentExerciseIndex]: {
          ...(completedSets[currentExerciseIndex] || {}),
          [currentSetIndex]: true,
        },
      };

      const updatedSetIndices = {
        ...currentSetIndices,
        [currentExerciseIndex]: nextSetIndex,
      };

      // Update weight and reps for the next set
      const currentWeightAndReps = weightAndReps[currentExerciseIndex]?.[
        currentSetIndex
      ] || {
        weight: "0",
        reps: "0",
      };

      if (nextSetIndex < currentExercise.sets.length) {
        // If there are more sets in the current exercise
        const nextSetWeightAndReps =
          weightAndReps[currentExerciseIndex]?.[nextSetIndex];

        const updatedNextSetWeightAndReps = {
          weight: currentWeightAndReps.weight, // Carry over weight
          reps:
            nextSetWeightAndReps?.reps !== undefined
              ? nextSetWeightAndReps.reps // Use historical data if available
              : currentWeightAndReps.reps, // Carry over reps from current set
        };

        const updatedWeightAndReps = {
          ...weightAndReps,
          [currentExerciseIndex]: {
            ...(weightAndReps[currentExerciseIndex] || {}),
            [nextSetIndex]: updatedNextSetWeightAndReps,
          },
        };

        return {
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
          weightAndReps: updatedWeightAndReps,
        };
      }

      // If no more sets, move to next exercise, skipping completed exercises
      let nextExerciseIndex = currentExerciseIndex + 1;
      while (nextExerciseIndex < workout.exercises.length) {
        const totalSets = workout.exercises[nextExerciseIndex].sets.length;
        const isExerciseCompleted =
          updatedCompletedSets[nextExerciseIndex] &&
          Object.keys(updatedCompletedSets[nextExerciseIndex]).length ===
            totalSets;

        if (!isExerciseCompleted) {
          // Found the next uncompleted exercise
          return {
            currentExerciseIndex: nextExerciseIndex,
            currentSetIndices: updatedSetIndices,
            completedSets: updatedCompletedSets,
          };
        }
        nextExerciseIndex++;
      }

      // If all exercises are completed, return to previous screen
      router.back();
      return {
        currentSetIndices: updatedSetIndices,
        completedSets: updatedCompletedSets,
      };
    }),

  updateWeightAndReps: (exerciseIndex, setIndex, weight, reps) =>
    set((state) => {
      const exerciseData = state.weightAndReps[exerciseIndex] || {};
      return {
        weightAndReps: {
          ...state.weightAndReps,
          [exerciseIndex]: {
            ...exerciseData,
            [setIndex]: { weight, reps },
          },
        },
      };
    }),

  initializeWeightAndReps: (previousWorkoutData) => {
    const { workout } = get();
    if (!workout) {
      return;
    }

    const weightAndReps: {
      [exerciseIndex: number]: {
        [setIndex: number]: { weight: string; reps: string };
      };
    } = {};

    workout.exercises.forEach((currentExercise, exerciseIndex) => {
      const previousExercise = previousWorkoutData.exercises.find(
        (prevEx) => prevEx.exercise_id === currentExercise.exercise_id,
      );

      weightAndReps[exerciseIndex] = {};

      if (previousExercise) {
        const setsToPrefill = Math.min(
          currentExercise.sets.length,
          previousExercise.sets.length,
        );

        for (let setIndex = 0; setIndex < setsToPrefill; setIndex++) {
          const prevSet = previousExercise.sets[setIndex];
          weightAndReps[exerciseIndex][setIndex] = {
            weight: prevSet.weight.toString(),
            reps: prevSet.reps.toString(),
          };
        }

        for (
          let setIndex = setsToPrefill;
          setIndex < currentExercise.sets.length;
          setIndex++
        ) {
          const lastKnownWeight =
            previousExercise.sets[
              previousExercise.sets.length - 1
            ].weight.toString();
          const lastKnownReps =
            previousExercise.sets[
              previousExercise.sets.length - 1
            ].reps.toString();
          weightAndReps[exerciseIndex][setIndex] = {
            weight: lastKnownWeight,
            reps: lastKnownReps,
          };
        }
      } else {
        for (
          let setIndex = 0;
          setIndex < currentExercise.sets.length;
          setIndex++
        ) {
          weightAndReps[exerciseIndex][setIndex] = {
            weight: "0",
            reps: "0",
          };
        }
      }
    });

    set({ weightAndReps });
  },

  resetWorkout: () =>
    set({
      workout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      startTime: null,
    }),

  setCurrentSetIndex: (exerciseIndex, setIndex) =>
    set((state) => ({
      currentSetIndices: {
        ...state.currentSetIndices,
        [exerciseIndex]: setIndex,
      },
    })),

  startTimer: (expiry) => set({ timerRunning: true, timerExpiry: expiry }),

  stopTimer: () => set({ timerRunning: false, timerExpiry: null }),
}));

export { useActiveWorkoutStore };
