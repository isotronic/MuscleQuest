import { create } from "zustand";
import { Exercise } from "@/utils/database";

export interface Set {
  repsMin: number | undefined;
  repsMax: number | undefined;
  restMinutes: number;
  restSeconds: number;
  time: number | undefined;
  isWarmup?: boolean;
  isDropSet?: boolean;
}

export interface UserExercise extends Exercise {
  sets: Set[];
  exercise_order?: number;
  is_deleted?: boolean;
}

export interface Workout {
  id?: number;
  name: string;
  is_deleted?: boolean;
  exercises: UserExercise[];
}

interface WorkoutStore {
  workouts: Workout[];
  newExerciseId: number | null;
  setNewExerciseId: (id: number | null) => void;
  planImageUrl: string;
  setPlanImageUrl: (url: string) => void;
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
  removeSetFromExercise: (
    workoutIndex: number,
    exerciseId: number,
    setIndex: number,
  ) => void;
}

const useWorkoutStore = create<WorkoutStore>((set) => ({
  workouts: [],
  newExerciseId: null,
  setNewExerciseId: (id) => set((state) => ({ ...state, newExerciseId: id })),
  planImageUrl:
    "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", // Default image URL
  setPlanImageUrl: (url) => set({ planImageUrl: url }),
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
        }
        const exercises = workout.exercises.map((exercise) => {
          if (exercise.exercise_id !== exerciseId) {
            return exercise;
          }
          return {
            ...exercise,
            sets: [...exercise.sets, newSet],
          };
        });
        return {
          ...workout,
          exercises,
        };
      });
      return { workouts };
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
        }
        const exercises = workout.exercises.map((exercise) => {
          if (exercise.exercise_id !== exerciseId) {
            return exercise;
          }
          const sets = exercise.sets.map((set, sIndex) => {
            if (sIndex !== setIndex) {
              return set;
            }
            return updatedSet;
          });
          return {
            ...exercise,
            sets,
          };
        });
        return {
          ...workout,
          exercises,
        };
      });
      return { workouts };
    });
  },
  removeSetFromExercise: (
    workoutIndex: number,
    exerciseId: number,
    setIndex: number,
  ) => {
    set((state) => {
      const workouts = state.workouts.map((workout, wIndex) => {
        if (wIndex !== workoutIndex) {
          return workout;
        }
        const exercises = workout.exercises.map((exercise) => {
          if (exercise.exercise_id !== exerciseId) {
            return exercise;
          }
          const sets = exercise.sets.filter((_, sIndex) => sIndex !== setIndex);
          return {
            ...exercise,
            sets,
          };
        });
        return {
          ...workout,
          exercises,
        };
      });
      return { workouts };
    });
  },
}));

export { useWorkoutStore };
