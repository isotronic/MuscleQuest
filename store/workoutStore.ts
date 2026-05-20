import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Exercise } from "@/utils/database";
import * as Crypto from "expo-crypto";

export const DEFAULT_PLAN_IMAGE_URL =
  "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export interface Set {
  repsMin: number | undefined;
  repsMax: number | undefined;
  restMinutes: number;
  restSeconds: number;
  time: number | undefined;
  distance?: number | undefined;
  isWarmup?: boolean;
  isDropSet?: boolean;
  isToFailure?: boolean;
}

export interface UserExercise extends Exercise {
  sets: Set[];
  exercise_order?: number;
  is_deleted?: boolean;
  supersetGroupId?: string;
}

export interface Workout {
  id?: number | null;
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
  reorderWorkouts: (fromIndex: number, toIndex: number) => void;
  changeWorkoutName: (index: number, name: string) => void;
  addExercise: (index: number, exercise: UserExercise) => void;
  removeExercise: (
    index: number,
    exerciseId: UserExercise["exercise_id"],
  ) => void;
  replaceExercise: (
    workoutIndex: number,
    exerciseIndex: number,
    newExercise: UserExercise,
    defaultSets: Set[],
    defaultTimeSets: Set[],
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
  createSuperset: (
    workoutIndex: number,
    exerciseIndex: number,
    newExercise: UserExercise,
  ) => void;
  removeFromSuperset: (workoutIndex: number, exerciseIndex: number) => void;
  // Schedule state (day_of_week 0-6 -> workout array index)
  planSchedule: Record<number, number>;
  setPlanSchedule: (schedule: Record<number, number>) => void;
  clearPlanSchedule: () => void;
  syncScheduleOnRemoveWorkout: (removedIndex: number) => void;
  // Draft persistence metadata
  draftContext: "plan" | "standalone" | null;
  draftId: number | null;
  draftName: string;
  setDraftContext: (context: "plan" | "standalone" | null) => void;
  setDraftId: (id: number | null) => void;
  setDraftName: (name: string) => void;
  clearDraft: () => void;
}

const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      workouts: [],
      newExerciseId: null,
      setNewExerciseId: (id) =>
        set((state) => ({ ...state, newExerciseId: id })),
      planImageUrl: DEFAULT_PLAN_IMAGE_URL,
      setPlanImageUrl: (url) => set({ planImageUrl: url }),
      setWorkouts: (workouts) => set({ workouts }),
      clearWorkouts: () => set({ workouts: [] }),
      addWorkout: (workout) =>
        set((state) => ({ ...state, workouts: [...state.workouts, workout] })),
      removeWorkout: (index) =>
        set((state) => {
          const workouts = state.workouts.filter((_, i) => i !== index);
          const planSchedule: Record<number, number> = {};
          for (const [day, idx] of Object.entries(state.planSchedule)) {
            const workoutIdx = Number(idx);
            if (workoutIdx === index) continue;
            planSchedule[Number(day)] =
              workoutIdx > index ? workoutIdx - 1 : workoutIdx;
          }
          return { workouts, planSchedule };
        }),
      reorderWorkouts: (fromIndex, toIndex) =>
        set((state) => {
          const { length } = state.workouts;
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            fromIndex >= length ||
            toIndex < 0 ||
            toIndex >= length
          ) {
            return state;
          }
          const updated = [...state.workouts];
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);

          // Remap schedule day → index entries to reflect the new workout order
          const remappedSchedule: Record<number, number> = {};
          for (const [day, idx] of Object.entries(state.planSchedule)) {
            const dayKey = Number(day);
            const workoutIdx = Number(idx);
            if (workoutIdx === fromIndex) {
              remappedSchedule[dayKey] = toIndex;
            } else if (
              fromIndex < toIndex &&
              workoutIdx > fromIndex &&
              workoutIdx <= toIndex
            ) {
              remappedSchedule[dayKey] = workoutIdx - 1;
            } else if (
              fromIndex > toIndex &&
              workoutIdx >= toIndex &&
              workoutIdx < fromIndex
            ) {
              remappedSchedule[dayKey] = workoutIdx + 1;
            } else {
              remappedSchedule[dayKey] = workoutIdx;
            }
          }

          return {
            ...state,
            workouts: updated,
            planSchedule: remappedSchedule,
          };
        }),
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
                exercises: w.exercises.filter(
                  (e) => e.exercise_id !== exerciseId,
                ),
              };
            }
            return w;
          }),
        })),
      replaceExercise: (
        workoutIndex,
        exerciseIndex,
        newExercise,
        defaultSets,
        defaultTimeSets,
      ) => {
        set((state) => {
          const updatedWorkouts = [...state.workouts];
          const workout = updatedWorkouts[workoutIndex];

          if (!workout || !workout.exercises[exerciseIndex]) {
            return { workouts: updatedWorkouts };
          }

          const oldExercise = workout.exercises[exerciseIndex];
          let oldTrackingType = oldExercise.tracking_type;
          let newTrackingType = newExercise.tracking_type;
          if (oldTrackingType === "" || oldTrackingType === null) {
            oldTrackingType = "weight";
          }
          if (newTrackingType === "" || newTrackingType === null) {
            newTrackingType = "weight";
          }

          if (oldTrackingType === newTrackingType) {
            // Same tracking type: carry over old sets
            newExercise.sets = oldExercise.sets;
          } else if (newTrackingType === "time") {
            newExercise.sets = defaultTimeSets;
          } else if (
            (newTrackingType === "assisted" && oldTrackingType === "weight") ||
            (newTrackingType === "weight" && oldTrackingType === "assisted")
          ) {
            newExercise.sets = oldExercise.sets;
          } else {
            newExercise.sets = defaultSets;
          }

          const updatedExercises = [...workout.exercises];
          updatedExercises[exerciseIndex] = newExercise;
          updatedWorkouts[workoutIndex] = {
            ...workout,
            exercises: updatedExercises,
          };

          return { workouts: updatedWorkouts };
        });
      },
      addSetToExercise: (
        workoutIndex: number,
        exerciseId: number,
        newSet: Set,
      ) => {
        set((state) => {
          const workout = state.workouts[workoutIndex];
          if (!workout) return state;

          const targetExercise = workout.exercises.find(
            (e) => e.exercise_id === exerciseId,
          );
          const supersetGroupId = targetExercise?.supersetGroupId;
          const partner = supersetGroupId
            ? workout.exercises.find(
                (e) =>
                  e.exercise_id !== exerciseId &&
                  e.supersetGroupId === supersetGroupId,
              )
            : null;

          const workouts = state.workouts.map((w, wIndex) => {
            if (wIndex !== workoutIndex) return w;
            const exercises = w.exercises.map((exercise) => {
              if (exercise.exercise_id === exerciseId) {
                return { ...exercise, sets: [...exercise.sets, newSet] };
              }
              // Mirror to superset partner: copy partner's last set as template
              if (partner && exercise.exercise_id === partner.exercise_id) {
                const lastSet =
                  exercise.sets[exercise.sets.length - 1] ?? newSet;
                return {
                  ...exercise,
                  sets: [...exercise.sets, { ...lastSet }],
                };
              }
              return exercise;
            });
            return { ...w, exercises };
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
          const workout = state.workouts[workoutIndex];
          if (!workout) return state;

          const targetExercise = workout.exercises.find(
            (e) => e.exercise_id === exerciseId,
          );
          const supersetGroupId = targetExercise?.supersetGroupId;
          const partner = supersetGroupId
            ? workout.exercises.find(
                (e) =>
                  e.exercise_id !== exerciseId &&
                  e.supersetGroupId === supersetGroupId,
              )
            : null;

          const workouts = state.workouts.map((w, wIndex) => {
            if (wIndex !== workoutIndex) {
              return w;
            }
            const exercises = w.exercises.map((exercise) => {
              if (exercise.exercise_id === exerciseId) {
                // Must keep at least 1 set
                if (exercise.sets.length <= 1) return exercise;
                return {
                  ...exercise,
                  sets: exercise.sets.filter(
                    (_, sIndex) => sIndex !== setIndex,
                  ),
                };
              }
              // Mirror removal to superset partner
              if (partner && exercise.exercise_id === partner.exercise_id) {
                if (exercise.sets.length <= 1) return exercise;
                return {
                  ...exercise,
                  sets: exercise.sets.filter(
                    (_, sIndex) => sIndex !== setIndex,
                  ),
                };
              }
              return exercise;
            });
            return {
              ...w,
              exercises,
            };
          });
          return { workouts };
        });
      },
      createSuperset: (workoutIndex, exerciseIndex, newExercise) =>
        set((state) => {
          const groupId = Crypto.randomUUID();
          const updatedWorkouts = state.workouts.map((w, i) => {
            if (i !== workoutIndex) return w;
            const exercises = [...w.exercises];
            exercises[exerciseIndex] = {
              ...exercises[exerciseIndex],
              supersetGroupId: groupId,
            };
            exercises.splice(exerciseIndex + 1, 0, {
              ...newExercise,
              supersetGroupId: groupId,
            });
            return { ...w, exercises };
          });
          return { workouts: updatedWorkouts };
        }),

      removeFromSuperset: (workoutIndex, exerciseIndex) =>
        set((state) => {
          const updatedWorkouts = state.workouts.map((w, i) => {
            if (i !== workoutIndex) return w;
            const groupId = w.exercises[exerciseIndex]?.supersetGroupId;
            if (!groupId) return w;
            const exercises = w.exercises.map((e) => {
              if (e.supersetGroupId !== groupId) return e;
              const { supersetGroupId: _, ...rest } = e;
              return rest as UserExercise;
            });
            return { ...w, exercises };
          });
          return { workouts: updatedWorkouts };
        }),

      // Schedule actions
      planSchedule: {},
      setPlanSchedule: (schedule) =>
        set((state) => {
          const numWorkouts = state.workouts.length;
          const validated: Record<number, number> = {};
          for (const [day, idx] of Object.entries(schedule)) {
            const dayKey = Number(day);
            const workoutIdx = Number(idx);
            if (
              Number.isInteger(dayKey) &&
              dayKey >= 0 &&
              dayKey <= 6 &&
              Number.isInteger(workoutIdx) &&
              workoutIdx >= 0 &&
              workoutIdx < numWorkouts
            ) {
              validated[dayKey] = workoutIdx;
            }
          }
          return { planSchedule: validated };
        }),
      clearPlanSchedule: () => set({ planSchedule: {} }),
      syncScheduleOnRemoveWorkout: (removedIndex) =>
        set((state) => {
          const updated: Record<number, number> = {};
          for (const [day, idx] of Object.entries(state.planSchedule)) {
            const workoutIdx = Number(idx);
            if (workoutIdx === removedIndex) continue; // drop this day
            updated[Number(day)] =
              workoutIdx > removedIndex ? workoutIdx - 1 : workoutIdx;
          }
          return { planSchedule: updated };
        }),

      draftContext: null,
      draftId: null,
      draftName: "",
      setDraftContext: (context) => set({ draftContext: context }),
      setDraftId: (id) => set({ draftId: id }),
      setDraftName: (name) => set({ draftName: name }),
      clearDraft: () =>
        set({
          workouts: [],
          planImageUrl: DEFAULT_PLAN_IMAGE_URL,
          planSchedule: {},
          draftContext: null,
          draftId: null,
          draftName: "",
        }),
    }),
    {
      name: "workout-draft-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        workouts: state.workouts,
        planImageUrl: state.planImageUrl,
        planSchedule: state.planSchedule,
        draftContext: state.draftContext,
        draftId: state.draftId,
        draftName: state.draftName,
      }),
    },
  ),
);

export { useWorkoutStore };
