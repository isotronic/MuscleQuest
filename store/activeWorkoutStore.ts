import { create } from "zustand";
import { Workout } from "./workoutStore";

interface ActiveWorkoutStore {
  workout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndices: { [exerciseIndex: number]: number };
  completedSets: {
    [exerciseIndex: number]: { [setIndex: number]: boolean };
  }; // Updated to track whether each set is completed
  weightAndReps: {
    [exerciseIndex: number]: {
      [setIndex: number]: { weight: string; reps: string };
    };
  }; // Track weight and reps
  timerRunning: boolean;
  timerExpiry: Date | null;
  setWorkout: (workout: Workout) => void;
  nextSet: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetIndex: (exerciseIndex: number, setIndex: number) => void;
  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight: string,
    reps: string,
  ) => void;
  resetWorkout: () => void;
  startTimer: (expiry: Date) => void;
  stopTimer: () => void;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>((set) => ({
  workout: null,
  currentExerciseIndex: 0,
  currentSetIndices: {},
  completedSets: {}, // Initialize completed sets as empty object
  weightAndReps: {}, // Initialize weight and reps tracking
  timerRunning: false,
  timerExpiry: null,

  setWorkout: (workout) =>
    set({
      workout,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {}, // Reset completed sets
      weightAndReps: {}, // Reset weight and reps
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
      const nextExerciseIndex = currentExerciseIndex + 1;

      const currentWeight =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight || "0";
      const currentReps =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps || "0";

      const updatedCompletedSets = {
        ...completedSets,
        [currentExerciseIndex]: {
          ...(completedSets[currentExerciseIndex] || {}),
          [currentSetIndex]: true, // Mark current set as completed
        },
      };

      const updatedSetIndices = {
        ...currentSetIndices,
        [currentExerciseIndex]: nextSetIndex,
      };

      if (nextSetIndex < currentExercise.sets.length) {
        const updatedWeightAndReps = {
          ...weightAndReps,
          [currentExerciseIndex]: {
            ...(weightAndReps[currentExerciseIndex] || {}),
            [nextSetIndex]: { weight: currentWeight, reps: currentReps },
          },
        };

        return {
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
          weightAndReps: updatedWeightAndReps,
        };
      } else if (nextExerciseIndex < workout.exercises.length) {
        const updatedWeightAndReps = {
          ...weightAndReps,
          [nextExerciseIndex]: {
            0: { weight: "0", reps: "0" },
          },
        };

        return {
          currentExerciseIndex: nextExerciseIndex,
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
          weightAndReps: updatedWeightAndReps,
        };
      } else {
        return {
          workout: null,
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
        };
      }
    }),

  updateWeightAndReps: (exerciseIndex, setIndex, weight, reps) =>
    set((state) => ({
      weightAndReps: {
        ...state.weightAndReps,
        [exerciseIndex]: {
          ...(state.weightAndReps[exerciseIndex] || {}),
          [setIndex]: { weight, reps },
        },
      },
    })),

  resetWorkout: () =>
    set({
      workout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
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
