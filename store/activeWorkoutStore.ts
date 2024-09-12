import { create } from "zustand";
import { Workout } from "./workoutStore";

interface ActiveWorkoutStore {
  workout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndices: { [exerciseIndex: number]: number };
  completedSets: { [exerciseIndex: number]: number };
  weightAndReps: {
    [exerciseIndex: number]: {
      [setIndex: number]: { weight: string; reps: string };
    };
  }; // New field to track weight and reps
  timerRunning: boolean;
  timerExpiry: Date | null; // Store the timer expiry time globally
  setWorkout: (workout: Workout) => void;
  nextSet: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetIndex: (exerciseIndex: number, setIndex: number) => void;
  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight: string,
    reps: string,
  ) => void; // New function to update weight and reps
  resetWorkout: () => void;
  startTimer: (expiry: Date) => void; // Update to accept expiry time
  stopTimer: () => void;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>((set) => ({
  workout: null,
  currentExerciseIndex: 0,
  currentSetIndices: {},
  currentSetIndex: 0,
  completedSets: {},
  weightAndReps: {}, // Initialize empty object
  timerRunning: false,
  timerExpiry: null,

  setWorkout: (workout) =>
    set({
      workout,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {}, // Reset weight and reps tracking
      timerRunning: false,
      timerExpiry: null,
    }),

  setCurrentExerciseIndex: (index: number) =>
    set((state) => {
      const currentSetIndex = state.currentSetIndices[index] || 0; // Restore current set index for this exercise
      return { currentExerciseIndex: index, currentSetIndex };
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

      // Carry over weight and reps for the next set
      const currentWeight =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.weight || "0";
      const currentReps =
        weightAndReps[currentExerciseIndex]?.[currentSetIndex]?.reps || "0";

      // Update completed sets for the current exercise
      const updatedCompletedSets = {
        ...completedSets,
        [currentExerciseIndex]: (completedSets[currentExerciseIndex] || 0) + 1,
      };

      // Update the current set index for this exercise
      const updatedSetIndices = {
        ...currentSetIndices,
        [currentExerciseIndex]: nextSetIndex,
      };

      if (nextSetIndex < currentExercise.sets.length) {
        // Carry over weight and reps to the next set
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
        // Move to the next exercise, reset weight and reps for the new exercise
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
        // If workout is complete
        return {
          workout: null,
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
        };
      }
    }),

  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight: string,
    reps: string,
  ) =>
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

  setCurrentSetIndex: (exerciseIndex: number, setIndex: number) =>
    set((state) => ({
      currentSetIndices: {
        ...state.currentSetIndices,
        [exerciseIndex]: setIndex,
      },
    })),

  startTimer: (expiry: Date) =>
    set({ timerRunning: true, timerExpiry: expiry }), // Start timer with expiry

  stopTimer: () => set({ timerRunning: false, timerExpiry: null }), // Stop timer and reset expiry
}));

export { useActiveWorkoutStore };
