import { create } from "zustand";
import { Exercise } from "@/utils/database";

interface Set {
  repsMin: number;
  repsMax: number;
  restMinutes: number;
  restSeconds: number;
}

export interface UserExercise extends Exercise {
  sets: Set[];
}

export interface Workout {
  name: string;
  exercises: UserExercise[];
}

interface WorkoutStore {
  workouts: Workout[];
  setWorkouts: (workouts: Workout[]) => void;
  clearWorkouts: () => void;
  addWorkout: (workout: Workout) => void;
  removeWorkout: (index: number) => void;
  changeWorkoutName: (index: number, name: string) => void;
  addExercise: (index: number, exercise: UserExercise) => void;
  removeExercise: (
    index: number,
    exerciseId: UserExercise["exercise_id"],
  ) => void;
  addSetToExercise: (
    workoutIndex: number,
    exerciseId: number,
    set: Set,
  ) => void;
  updateSetInExercise: (
    workoutIndex: number,
    exerciseId: number,
    setIndex: number,
    set: Set,
  ) => void;
}

const useWorkoutStore = create<WorkoutStore>((set) => ({
  workouts: [],
  setWorkouts: (workouts) => set({ workouts }),
  clearWorkouts: () => set({ workouts: [] }),
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
  addSetToExercise: (workoutIndex: number, exerciseId: number, newSet: Set) => {
    set((state) => {
      const workouts = state.workouts.map((workout, wIndex) => {
        if (wIndex !== workoutIndex) {
          return workout;
        } // Return other workouts unchanged

        const exercises = workout.exercises.map((exercise) => {
          if (exercise.exercise_id !== exerciseId) {
            return exercise;
          } // Return other exercises unchanged

          // Return a new exercise object with a new sets array
          return {
            ...exercise,
            sets: [...exercise.sets, newSet], // Create a new array by adding newSet
          };
        });

        return {
          ...workout,
          exercises, // Replace the exercises array with the new version
        };
      });

      return { workouts }; // Replace the workouts array with the new version
    });
  },

  updateSetInExercise: (
    workoutIndex: number,
    exerciseId: number,
    setIndex: number,
    updatedSet: Set,
  ) => {
    set((state) => {
      const workouts = state.workouts.map((workout, wIndex) => {
        if (wIndex !== workoutIndex) {
          return workout;
        } // Return other workouts unchanged

        const exercises = workout.exercises.map((exercise) => {
          if (exercise.exercise_id !== exerciseId) {
            return exercise;
          } // Return other exercises unchanged

          const sets = exercise.sets.map((set, sIndex) => {
            if (sIndex !== setIndex) {
              return set;
            } // Return other sets unchanged

            return updatedSet; // Replace the set at setIndex
          });

          return {
            ...exercise,
            sets, // Replace the sets array with the updated version
          };
        });

        return {
          ...workout,
          exercises, // Replace the exercises array with the new version
        };
      });

      return { workouts }; // Replace the workouts array with the new version
    });
  },
}));

export { useWorkoutStore };
