import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserExercise, Workout } from "./workoutStore";
import { router } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { formatFromTotalSeconds } from "@/utils/utility";
import Bugsnag from "@bugsnag/expo";

interface ActiveWorkoutStore {
  activeWorkout: { planId: number; workoutId: number; name: string } | null;
  workout: Workout | null;
  originalWorkout: Workout | null;
  currentExerciseIndex: number;
  currentSetIndices: { [exerciseIndex: number]: number };
  completedSets: {
    [exerciseIndex: number]: { [setIndex: number]: boolean };
  };
  weightAndReps: {
    [exerciseIndex: number]: {
      [setIndex: number]: { weight?: string; reps?: string; time?: string };
    };
  };
  previousWorkoutData: CompletedWorkout[] | null;
  startTime: Date;
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
  addSet: () => void;
  removeSet: (setIndex: number) => void;
  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight?: string,
    reps?: string,
    time?: string,
  ) => void;
  initializeWeightAndReps: (completedWorkouts: CompletedWorkout[]) => void;
  replaceExercise: (index: number, newExercise: UserExercise) => void;
  deleteExercise: (index: number) => void;
  restartWorkout: () => void;
  startTimer: (expiry: Date) => void;
  stopTimer: () => void;
  clearPersistedStore: () => void;
  resumeWorkout: () => void;
  isWorkoutInProgress: () => boolean;
  getActiveWorkoutId: () => number | null;
}

const useActiveWorkoutStore = create<ActiveWorkoutStore>()(
  persist(
    (set, get) => ({
      activeWorkout: null,
      workout: null,
      originalWorkout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      previousWorkoutData: null,
      startTime: new Date(),
      timerRunning: false,
      timerExpiry: null,

      setWorkout: (workout, planId, workoutId, name) =>
        set({
          activeWorkout: { planId, workoutId, name },
          workout: JSON.parse(JSON.stringify(workout)),
          originalWorkout: JSON.parse(JSON.stringify(workout)),
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          previousWorkoutData: null,
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
            previousWorkoutData,
          } = state;

          if (!workout) {
            return state;
          }

          const currentExercise = workout.exercises[currentExerciseIndex];
          const trackingType = currentExercise.tracking_type || "weight";
          const currentSetIndex = currentSetIndices[currentExerciseIndex] || 0;
          const nextSetIndex = currentSetIndex + 1;

          // Mark the current set as completed
          const updatedCompletedSets = {
            ...completedSets,
            [currentExerciseIndex]: {
              ...(completedSets[currentExerciseIndex] || {}),
              [currentSetIndex]: true,
            },
          };

          // Check if current set is warm-up
          const isWarmup =
            currentExercise.sets[currentSetIndex]?.isWarmup || false;

          // Check if current set is a drop set
          const isDropSet =
            currentExercise.sets[currentSetIndex]?.isDropSet || false;

          // Check if next set is drop set
          const isNextDropSet =
            nextSetIndex < currentExercise.sets.length &&
            currentExercise.sets[nextSetIndex]?.isDropSet;

          // Update the set index for the current exercise
          const updatedSetIndices = {
            ...currentSetIndices,
            [currentExerciseIndex]: nextSetIndex,
          };

          // Retrieve historical data for the next set
          const previousExerciseData = previousWorkoutData
            ?.flatMap((workout) => workout.exercises)
            .find(
              (prevEx) => prevEx.exercise_id === currentExercise.exercise_id,
            );

          // Retrieve values from the current set and historical data for the next set
          const currentSetValues =
            weightAndReps[currentExerciseIndex]?.[currentSetIndex] || {};
          const nextSetValues =
            previousExerciseData?.sets[nextSetIndex] || undefined;

          // Determine the values to carry over based on `tracking_type`
          const updatedNextSetValues = {
            ...(trackingType === "weight" || trackingType === ""
              ? {
                  weight:
                    (isWarmup || isDropSet || isNextDropSet) &&
                    nextSetValues?.weight
                      ? nextSetValues.weight.toString()
                      : currentSetValues.weight,
                  reps:
                    nextSetValues?.reps !== undefined
                      ? nextSetValues.reps?.toString()
                      : undefined,
                }
              : {}),
            ...(trackingType === "assisted"
              ? {
                  weight:
                    (isWarmup || isDropSet || isNextDropSet) &&
                    nextSetValues?.weight
                      ? nextSetValues.weight.toString()
                      : currentSetValues.weight,
                  reps:
                    nextSetValues?.reps !== undefined
                      ? nextSetValues.reps?.toString()
                      : undefined,
                }
              : {}),
            ...(trackingType === "reps"
              ? {
                  reps:
                    nextSetValues?.reps !== undefined
                      ? nextSetValues.reps?.toString()
                      : undefined,
                }
              : {}),
            ...(trackingType === "time"
              ? {
                  time:
                    nextSetValues?.time !== undefined
                      ? formatFromTotalSeconds(nextSetValues.time ?? 0)
                      : undefined,
                }
              : {}),
          };

          // Update the weightAndReps with the new values for the next set
          const updatedWeightAndReps = {
            ...weightAndReps,
            [currentExerciseIndex]: {
              ...(weightAndReps[currentExerciseIndex] || {}),
              [nextSetIndex]: updatedNextSetValues,
            },
          };

          // If there are more sets in the current exercise, update the store accordingly
          if (nextSetIndex < currentExercise.sets.length) {
            return {
              currentSetIndices: updatedSetIndices,
              completedSets: updatedCompletedSets,
              weightAndReps: updatedWeightAndReps,
            };
          }

          // Move to the next exercise if all sets are complete in the current exercise
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

          // If all exercises are completed, navigate back
          router.back();
          return {
            currentSetIndices: updatedSetIndices,
            completedSets: updatedCompletedSets,
          };
        }),

      addSet: () =>
        set((state) => {
          const {
            workout,
            weightAndReps,
            completedSets,
            currentExerciseIndex,
          } = state;

          if (!workout) {
            return state;
          }

          const currentExercise = workout.exercises[currentExerciseIndex];
          const lastSetIndex = currentExercise.sets.length - 1;
          const lastSet = currentExercise.sets[lastSetIndex];
          const trackingType = currentExercise.tracking_type || "weight";

          // Create a new set by copying the last set
          const newSet = { ...lastSet };

          // Add the new set to the workout's sets array
          const updatedExercises = [...workout.exercises];
          updatedExercises[currentExerciseIndex].sets.push(newSet);

          // Set default values for weight, reps, or time based on tracking_type
          const lastSetValues =
            weightAndReps[currentExerciseIndex]?.[lastSetIndex] || {};
          const newSetValues = {
            ...(trackingType === "weight" || trackingType === ""
              ? { weight: lastSetValues.weight, reps: lastSetValues.reps }
              : {}),
            ...(trackingType === "assisted"
              ? { weight: lastSetValues.weight, reps: lastSetValues.reps }
              : {}),
            ...(trackingType === "reps" ? { reps: lastSetValues.reps } : {}),
            ...(trackingType === "time" ? { time: lastSetValues.time } : {}),
          };

          // Update the store with the new set in weightAndReps and completedSets
          return {
            workout: { ...workout, exercises: updatedExercises },
            weightAndReps: {
              ...weightAndReps,
              [currentExerciseIndex]: {
                ...(weightAndReps[currentExerciseIndex] || {}),
                [updatedExercises[currentExerciseIndex].sets.length - 1]:
                  newSetValues,
              },
            },
            completedSets: {
              ...completedSets,
              [currentExerciseIndex]: {
                ...(completedSets[currentExerciseIndex] || {}),
                [updatedExercises[currentExerciseIndex].sets.length - 1]: false,
              },
            },
          };
        }),

      // Remove a set from the current exercise
      removeSet: (setIndex) => {
        set((state) => {
          const {
            workout,
            weightAndReps,
            completedSets,
            currentSetIndices,
            currentExerciseIndex,
          } = state;

          if (
            !workout ||
            workout.exercises[currentExerciseIndex].sets.length <= 1
          ) {
            return state; // Prevent deletion if it's the only set left
          }

          const updatedExercises = [...workout.exercises];
          updatedExercises[currentExerciseIndex].sets.splice(setIndex, 1);

          // Re-index weightAndReps after deletion
          const updatedWeightAndReps = { ...weightAndReps };
          if (updatedWeightAndReps[currentExerciseIndex]) {
            const exerciseWeightAndReps = {
              ...updatedWeightAndReps[currentExerciseIndex],
            };
            // Remove the deleted set and shift down higher indices
            const reindexed: typeof exerciseWeightAndReps = {};
            Object.keys(exerciseWeightAndReps).forEach((key) => {
              const index = parseInt(key, 10);
              if (index < setIndex) {
                reindexed[index] = exerciseWeightAndReps[index];
              } else if (index > setIndex) {
                reindexed[index - 1] = exerciseWeightAndReps[index];
              }
              // Skip the deleted index
            });
            updatedWeightAndReps[currentExerciseIndex] = reindexed;
          }

          // Re-index completedSets after deletion
          const updatedCompletedSets = { ...completedSets };
          if (updatedCompletedSets[currentExerciseIndex]) {
            const exerciseCompletedSets = {
              ...updatedCompletedSets[currentExerciseIndex],
            };
            // Remove the deleted set and shift down higher indices
            const reindexed: typeof exerciseCompletedSets = {};
            Object.keys(exerciseCompletedSets).forEach((key) => {
              const index = parseInt(key, 10);
              if (index < setIndex) {
                reindexed[index] = exerciseCompletedSets[index];
              } else if (index > setIndex) {
                reindexed[index - 1] = exerciseCompletedSets[index];
              }
              // Skip the deleted index
            });
            updatedCompletedSets[currentExerciseIndex] = reindexed;
          }

          // Adjust currentSetIndices if the removed set was at or before current position
          const updatedSetIndices = { ...currentSetIndices };
          const currentSetIndex = updatedSetIndices[currentExerciseIndex] || 0;
          if (currentSetIndex >= setIndex && currentSetIndex > 0) {
            updatedSetIndices[currentExerciseIndex] = currentSetIndex - 1;
          }
          // Ensure current set index doesn't exceed array bounds
          if (
            updatedSetIndices[currentExerciseIndex] >=
            updatedExercises[currentExerciseIndex].sets.length
          ) {
            updatedSetIndices[currentExerciseIndex] =
              updatedExercises[currentExerciseIndex].sets.length - 1;
          }

          return {
            workout: { ...workout, exercises: updatedExercises },
            weightAndReps: updatedWeightAndReps,
            completedSets: updatedCompletedSets,
            currentSetIndices: updatedSetIndices,
          };
        });
      },

      updateWeightAndReps: (
        exerciseIndex: number,
        setIndex: number,
        weight?: string,
        reps?: string,
        time?: string,
      ) =>
        set((state) => {
          const exerciseData = state.weightAndReps[exerciseIndex] || {};
          const trackingType =
            state.workout?.exercises[exerciseIndex].tracking_type || "weight";

          const updatedValues: {
            weight?: string;
            reps?: string;
            time?: string;
          } = {};

          if (trackingType === "weight" || trackingType === "") {
            updatedValues.weight = weight;
            updatedValues.reps = reps;
          } else if (trackingType === "assisted") {
            updatedValues.weight = weight;
            updatedValues.reps = reps;
          } else if (trackingType === "reps") {
            updatedValues.reps = reps;
          } else if (trackingType === "time") {
            updatedValues.time = time;
          }

          return {
            weightAndReps: {
              ...state.weightAndReps,
              [exerciseIndex]: {
                ...exerciseData,
                [setIndex]: updatedValues,
              },
            },
          };
        }),

      initializeWeightAndReps: (completedWorkouts: CompletedWorkout[]) => {
        const { workout } = get();
        if (!workout) {
          return;
        }

        // Sort completed workouts by date (most recent first)
        const sortedWorkouts = [...completedWorkouts].sort(
          (a, b) =>
            new Date(b.date_completed).getTime() -
            new Date(a.date_completed).getTime(),
        );

        set({ previousWorkoutData: sortedWorkouts });
      },

      replaceExercise: (index, newExercise) => {
        set((state) => {
          const { workout, currentSetIndices } = state;
          if (!workout) {
            return state;
          }

          const oldExerciseSets = workout.exercises[index].sets;
          const newExerciseWithSets = { ...newExercise, sets: oldExerciseSets };

          // Reset weight and reps to "0" for each set of the new exercise
          const resetWeightAndReps = oldExerciseSets.reduce(
            (acc: any, _set: any, setIndex: number) => {
              acc[setIndex] = { weight: "0", reps: "0" };
              return acc;
            },
            {},
          );

          // Reset completed sets: All sets are marked as not completed
          const resetCompletedSets = oldExerciseSets.reduce(
            (acc: any, _set: any, setIndex: number) => {
              acc[setIndex] = false; // Set all sets as not completed
              return acc;
            },
            {},
          );

          // Replace the exercise at the given index with the new exercise
          const updatedExercises = [...workout.exercises];
          updatedExercises[index] = newExerciseWithSets;

          return {
            workout: { ...workout, exercises: updatedExercises },
            completedSets: {
              ...state.completedSets,
              [index]: resetCompletedSets, // Reset all sets to not completed
            },
            weightAndReps: {
              ...state.weightAndReps,
              [index]: resetWeightAndReps, // Reset weight and reps to 0
            },
            currentSetIndices: {
              ...currentSetIndices,
              [index]: 0, // Reset the current set index to 0
            },
          };
        });
      },

      deleteExercise: (index) => {
        set((state) => {
          const { workout, completedSets, weightAndReps, currentSetIndices } =
            state;
          if (!workout) {
            return state;
          }

          // Remove the exercise at the specified index
          const updatedExercises = workout.exercises.filter(
            (_, exerciseIndex) => exerciseIndex !== index,
          );

          // Remove the corresponding completed sets, weight/reps, and set index
          const { [index]: _, ...updatedCompletedSets } = completedSets;
          const { [index]: __, ...updatedWeightAndReps } = weightAndReps;
          const { [index]: ___, ...updatedSetIndices } = currentSetIndices;

          // Adjust indices for remaining sets and exercises, if necessary
          const adjustedCompletedSets = Object.keys(
            updatedCompletedSets,
          ).reduce(
            (acc, key) => {
              const parsedKey = parseInt(key, 10);
              acc[parsedKey > index ? parsedKey - 1 : parsedKey] =
                updatedCompletedSets[parsedKey];
              return acc;
            },
            {} as typeof updatedCompletedSets,
          );

          const adjustedWeightAndReps = Object.keys(
            updatedWeightAndReps,
          ).reduce(
            (acc, key) => {
              const parsedKey = parseInt(key, 10);
              acc[parsedKey > index ? parsedKey - 1 : parsedKey] =
                updatedWeightAndReps[parsedKey];
              return acc;
            },
            {} as typeof updatedWeightAndReps,
          );

          const adjustedSetIndices = Object.keys(updatedSetIndices).reduce(
            (acc, key) => {
              const parsedKey = parseInt(key, 10);
              acc[parsedKey > index ? parsedKey - 1 : parsedKey] =
                updatedSetIndices[parsedKey];
              return acc;
            },
            {} as typeof updatedSetIndices,
          );

          return {
            workout: { ...workout, exercises: updatedExercises },
            completedSets: adjustedCompletedSets, // Remove and adjust completed sets
            weightAndReps: adjustedWeightAndReps, // Remove and adjust weight/reps
            currentSetIndices: adjustedSetIndices, // Adjust set indices
          };
        });
      },

      restartWorkout: () => {
        const { activeWorkout, originalWorkout } = get();

        if (!activeWorkout || !originalWorkout) {
          return; // No workout to restart
        }

        set({
          workout: JSON.parse(JSON.stringify(originalWorkout)), // Reset to original workout
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          startTime: new Date(), // Reset the start time to now
          timerRunning: false,
          timerExpiry: null,
        });
      },

      setCurrentSetIndex: (exerciseIndex, setIndex) =>
        set((state) => ({
          currentSetIndices: {
            ...state.currentSetIndices,
            [exerciseIndex]: setIndex,
          },
        })),

      startTimer: (expiry) =>
        set({
          timerRunning: true,
          timerExpiry: expiry,
        }),

      stopTimer: () => set({ timerRunning: false, timerExpiry: null }),

      clearPersistedStore: () => {
        // Reset the store to initial values and remove from AsyncStorage
        set({
          activeWorkout: null,
          workout: null,
          originalWorkout: null,
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          startTime: new Date(),
          timerRunning: false,
          timerExpiry: null,
        });
        // Clear from AsyncStorage
        AsyncStorage.removeItem("active-workout-store");
      },

      resumeWorkout: () => {
        const { activeWorkout, workout } = get();

        Bugsnag.leaveBreadcrumb("Resuming workout", {
          hasActiveWorkout: !!activeWorkout,
          hasWorkout: !!workout,
        });

        // Workout is already restored from storage with proper Date objects
        // Nothing else needs to be done
      },
      isWorkoutInProgress: () => {
        const { activeWorkout, workout } = get();
        return Boolean(activeWorkout && workout); // Returns true if there's an active workout
      },
      getActiveWorkoutId: () => get().activeWorkout?.workoutId || null,
    }),
    {
      name: "active-workout-store", // Key for AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
      // Add parsing for date objects during rehydration
      partialize: (state) => ({
        ...state,
        startTime:
          state.startTime instanceof Date
            ? state.startTime.toISOString()
            : state.startTime,
        timerExpiry: state.timerExpiry
          ? state.timerExpiry instanceof Date
            ? state.timerExpiry.toISOString()
            : state.timerExpiry
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert strings back to Date objects after rehydration
        if (state) {
          if (state.startTime) {
            state.startTime = new Date(state.startTime);
          }
          if (state.timerExpiry) {
            state.timerExpiry = new Date(state.timerExpiry);
          }
        }
      },
    },
  ),
);

export { useActiveWorkoutStore };
