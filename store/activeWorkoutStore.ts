import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserExercise, Workout } from "./workoutStore";
import { router } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

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
  addSet: () => void;
  removeSet: (setIndex: number) => void;
  updateWeightAndReps: (
    exerciseIndex: number,
    setIndex: number,
    weight: string,
    reps: string,
  ) => void;
  initializeWeightAndReps: (previousWorkoutData: CompletedWorkout) => void;
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
      startTime: null,
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

          // Create a new set by copying the last set
          const newSet = { ...lastSet }; // Copy the last set

          // Add the new set to the workout's sets array
          const updatedExercises = [...workout.exercises];
          updatedExercises[currentExerciseIndex].sets.push(newSet);

          // Copy the last set's weight and reps to the new set
          return {
            workout: { ...workout, exercises: updatedExercises },
            weightAndReps: {
              ...weightAndReps,
              [currentExerciseIndex]: {
                ...weightAndReps[currentExerciseIndex],
                [updatedExercises[currentExerciseIndex].sets.length - 1]: {
                  weight:
                    weightAndReps[currentExerciseIndex][lastSetIndex].weight,
                  reps: weightAndReps[currentExerciseIndex][lastSetIndex].reps,
                },
              },
            },
            completedSets: {
              ...completedSets,
              [currentExerciseIndex]: {
                ...completedSets[currentExerciseIndex],
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
            return state;
          }

          const updatedExercises = [...workout.exercises];
          updatedExercises[currentExerciseIndex].sets.splice(setIndex, 1);

          // Update weightAndReps and completedSets state
          const updatedWeightAndReps = { ...weightAndReps };
          if (updatedWeightAndReps[currentExerciseIndex]) {
            delete updatedWeightAndReps[currentExerciseIndex][setIndex];
          }

          const updatedCompletedSets = { ...completedSets };
          if (updatedCompletedSets[currentExerciseIndex]) {
            delete updatedCompletedSets[currentExerciseIndex][setIndex];
          }

          // Adjust currentSetIndices if the removed set was before or at the current set
          const updatedSetIndices = { ...currentSetIndices };
          if (updatedSetIndices[currentExerciseIndex] > setIndex) {
            updatedSetIndices[currentExerciseIndex]--;
          }

          return {
            workout: { ...workout, exercises: updatedExercises },
            weightAndReps: updatedWeightAndReps,
            completedSets: updatedCompletedSets,
            currentSetIndices: updatedSetIndices,
          };
        });
      },

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

      startTimer: (expiry) => set({ timerRunning: true, timerExpiry: expiry }),

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
          startTime: null,
          timerRunning: false,
          timerExpiry: null,
        });
        // Clear from AsyncStorage
        AsyncStorage.removeItem("active-workout-store");
      },

      resumeWorkout: () => {
        const { activeWorkout, workout } = get();

        // If there is already an active workout, continue with it.
        if (activeWorkout && workout) {
          return;
        }
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
    },
  ),
);

export { useActiveWorkoutStore };
