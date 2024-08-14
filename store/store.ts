import { Exercise } from "@/utils/database";
import { create } from "zustand";

interface Workout {
  name: string;
  exercises: Exercise[];
}

interface WorkoutStore {
  workouts: Workout[];
  addWorkout: (workout: Workout) => void;
  removeWorkout: (index: number) => void;
  changeWorkoutName: (index: number, name: string) => void;
  addExercise: (index: number, exercise: Exercise) => void;
  removeExercise: (index: number, exerciseId: Exercise["exercise_id"]) => void;
}

const useWorkoutStore = create<WorkoutStore>((set) => ({
  workouts: [],
  addWorkout: (workout) =>
    set((state) => ({ ...state, workouts: [...state.workouts, workout] })),
  removeWorkout: (index) =>
    set((state) => ({
      ...state,
      workouts: state.workouts.filter((_, i) => i !== index),
    })),
  changeWorkoutName: (index, name) =>
    set((state) => ({
      ...state,
      workouts: state.workouts.map((w, i) => {
        if (i === index) {
          return { ...w, name };
        }
        return w;
      }),
    })),
  addExercise: (index, exercise) => {
    set((state) => ({
      ...state,
      workouts: state.workouts.map((w, i) => {
        if (i === index) {
          return { ...w, exercises: [...w.exercises, exercise] };
        }
        return w;
      }),
    }));
  },
  removeExercise: (index, exerciseId) =>
    set((state) => ({
      ...state,
      workouts: state.workouts.map((w, i) => {
        if (i === index) {
          return {
            ...w,
            exercises: w.exercises.filter((e) => e.exercise_id !== exerciseId),
          };
        }
        return w;
      }),
    })),
}));

export { useWorkoutStore };
