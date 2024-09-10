import { create } from "zustand";
import { Workout } from "./workoutStore";

interface ActiveWorkoutStore {
  workout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndex: number;
  timerRunning: boolean;
  setWorkout: (workout: Workout) => void;
  nextSet: () => void;
  resetWorkout: () => void;
  startTimer: () => void;
  stopTimer: () => void;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>((set) => ({
  workout: null,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  timerRunning: false,

  setWorkout: (workout) =>
    set({ workout, currentExerciseIndex: 0, currentSetIndex: 0 }),

  nextSet: () =>
    set((state) => {
      const { workout, currentExerciseIndex, currentSetIndex } = state;
      if (!workout) {
        return state;
      }

      const currentExercise = workout.exercises[currentExerciseIndex];
      const nextSetIndex = currentSetIndex + 1;

      // Check if we have more sets in the current exercise
      if (nextSetIndex < currentExercise.sets.length) {
        return { currentSetIndex: nextSetIndex };
      }

      // Move to the next exercise if available
      const nextExerciseIndex = currentExerciseIndex + 1;
      if (nextExerciseIndex < workout.exercises.length) {
        return { currentExerciseIndex: nextExerciseIndex, currentSetIndex: 0 };
      }

      // If no more exercises, the workout is complete
      return { workout: null };
    }),

  resetWorkout: () =>
    set({ workout: null, currentExerciseIndex: 0, currentSetIndex: 0 }),

  startTimer: () => set({ timerRunning: true }),
  stopTimer: () => set({ timerRunning: false }),
}));

export { useActiveWorkoutStore };
