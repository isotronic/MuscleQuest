import { create } from "zustand";
import { Workout } from "./workoutStore";

interface ActiveWorkoutStore {
  workout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndices: { [exerciseIndex: number]: number };
  completedSets: { [exerciseIndex: number]: number };
  timerRunning: boolean;
  timerExpiry: Date | null; // Store the timer expiry time globally
  setWorkout: (workout: Workout) => void;
  nextSet: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetIndex: (exerciseIndex: number, setIndex: number) => void;
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
  timerRunning: false,
  timerExpiry: null,

  setWorkout: (workout) =>
    set({
      workout,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
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
        completedSets,
      } = state;
      if (!workout) {
        return state;
      }

      const currentExercise = workout.exercises[currentExerciseIndex];
      const nextSetIndex = (currentSetIndices[currentExerciseIndex] || 0) + 1;
      const nextExerciseIndex = currentExerciseIndex + 1;

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
        return {
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
        };
      } else if (nextExerciseIndex < workout.exercises.length) {
        return {
          currentExerciseIndex: nextExerciseIndex,
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
        };
      } else {
        return {
          workout: null,
          currentSetIndices: updatedSetIndices,
          completedSets: updatedCompletedSets,
        };
      }
    }),

  resetWorkout: () =>
    set({
      workout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
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
