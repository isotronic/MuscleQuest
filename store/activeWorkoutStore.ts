import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { UserExercise, Workout } from "./workoutStore";
import { router } from "expo-router";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { formatFromTotalSeconds } from "@/utils/utility";
import { findSupersetPartnerIndex } from "@/utils/supersetUtils";
import Bugsnag from "@bugsnag/expo";

/**
 * Helper function to re-index an object after removing an item at a specific index.
 * Items at indices less than removedIndex remain unchanged.
 * Items at indices greater than removedIndex are shifted down by 1.
 * The item at removedIndex is removed.
 */
function reindexAfterRemoval<T>(
  obj: { [key: number]: T },
  removedIndex: number,
): { [key: number]: T } {
  const reindexed: { [key: number]: T } = {};
  Object.keys(obj).forEach((key) => {
    const index = parseInt(key, 10);
    if (index < removedIndex) {
      reindexed[index] = obj[index];
    } else if (index > removedIndex) {
      reindexed[index - 1] = obj[index];
    }
    // Skip the deleted index
  });
  return reindexed;
}

interface ActiveWorkoutStore {
  activeWorkout: {
    planId: number | null;
    workoutId: number | null;
    name: string;
  } | null;
  workout: Workout | null;
  originalWorkout: Workout | null;
  isQuickWorkout: boolean;
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
  appendedExerciseIndices: number[];
  appendExercise: (exercise: UserExercise) => void;
  setWorkout: (
    workout: Workout,
    planId: number | null,
    workoutId: number | null,
    name: string,
  ) => void;
  startQuickWorkout: () => void;
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
  reorderExercises: (newExercises: UserExercise[]) => void;
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
      isQuickWorkout: false,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      previousWorkoutData: null,
      startTime: new Date(),
      timerRunning: false,
      timerExpiry: null,
      appendedExerciseIndices: [],

      setWorkout: (workout, planId, workoutId, name) =>
        set({
          activeWorkout: { planId, workoutId, name },
          workout: JSON.parse(JSON.stringify(workout)),
          originalWorkout: JSON.parse(JSON.stringify(workout)),
          isQuickWorkout: false,
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          previousWorkoutData: null,
          startTime: new Date(),
          timerRunning: false,
          timerExpiry: null,
          appendedExerciseIndices: [],
        }),

      startQuickWorkout: () =>
        set({
          activeWorkout: {
            planId: null,
            workoutId: null,
            name: "Quick Workout",
          },
          workout: { id: 0, name: "Quick Workout", exercises: [] },
          originalWorkout: { id: 0, name: "Quick Workout", exercises: [] },
          isQuickWorkout: true,
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          previousWorkoutData: null,
          startTime: new Date(),
          timerRunning: false,
          timerExpiry: null,
          appendedExerciseIndices: [],
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

          // Helper: build carry-over values for an exercise's next set
          const buildNextSetValues = (
            exerciseIndex: number,
            exercise: (typeof workout.exercises)[0],
            fromSetIndex: number,
            toSetIndex: number,
          ) => {
            const exTrackingType = exercise.tracking_type || "weight";
            const isWarmup = exercise.sets[fromSetIndex]?.isWarmup || false;
            const isDropSet = exercise.sets[fromSetIndex]?.isDropSet || false;
            const isNextDropSet =
              toSetIndex < exercise.sets.length &&
              exercise.sets[toSetIndex]?.isDropSet;
            const currentSetValues =
              weightAndReps[exerciseIndex]?.[fromSetIndex] || {};
            const previousExData = previousWorkoutData
              ?.flatMap((w) => w.exercises)
              .find((prevEx) => prevEx.exercise_id === exercise.exercise_id);
            const nextHistorical =
              previousExData?.sets[toSetIndex] || undefined;

            return {
              ...(exTrackingType === "weight" ||
              exTrackingType === "" ||
              exTrackingType === "assisted"
                ? {
                    weight:
                      (isWarmup || isDropSet || isNextDropSet) &&
                      nextHistorical?.weight
                        ? nextHistorical.weight.toString()
                        : currentSetValues.weight,
                    reps:
                      nextHistorical?.reps !== undefined
                        ? nextHistorical.reps?.toString()
                        : undefined,
                  }
                : {}),
              ...(exTrackingType === "reps"
                ? {
                    reps:
                      nextHistorical?.reps !== undefined
                        ? nextHistorical.reps?.toString()
                        : undefined,
                  }
                : {}),
              ...(exTrackingType === "time"
                ? {
                    time:
                      nextHistorical?.time !== undefined
                        ? formatFromTotalSeconds(nextHistorical.time ?? 0)
                        : undefined,
                  }
                : {}),
            };
          };

          // --- Superset handling ---
          if (currentExercise.supersetGroupId) {
            const partnerIndex = findSupersetPartnerIndex(
              workout.exercises,
              currentExerciseIndex,
            );

            if (partnerIndex !== -1) {
              const isFirstInSuperset = currentExerciseIndex < partnerIndex;

              if (isFirstInSuperset) {
                // Move to partner (second exercise), same set index — no rest
                const partnerSetIndex = currentSetIndices[partnerIndex] || 0;
                return {
                  currentExerciseIndex: partnerIndex,
                  currentSetIndices: {
                    ...currentSetIndices,
                    [partnerIndex]: partnerSetIndex,
                  },
                  completedSets: updatedCompletedSets,
                };
              }

              // Second in superset: advance both exercises' set indices then rest
              const firstIndex = partnerIndex;
              const firstExercise = workout.exercises[firstIndex];
              const updatedSetIndices = {
                ...currentSetIndices,
                [currentExerciseIndex]: nextSetIndex,
                [firstIndex]: nextSetIndex,
              };

              const firstNextValues = buildNextSetValues(
                firstIndex,
                firstExercise,
                currentSetIndex,
                nextSetIndex,
              );
              const secondNextValues = buildNextSetValues(
                currentExerciseIndex,
                currentExercise,
                currentSetIndex,
                nextSetIndex,
              );
              const updatedWeightAndReps = {
                ...weightAndReps,
                [firstIndex]: {
                  ...(weightAndReps[firstIndex] || {}),
                  [nextSetIndex]: firstNextValues,
                },
                [currentExerciseIndex]: {
                  ...(weightAndReps[currentExerciseIndex] || {}),
                  [nextSetIndex]: secondNextValues,
                },
              };

              const supersetLength = Math.max(
                currentExercise.sets.length,
                firstExercise.sets.length,
              );
              if (nextSetIndex < supersetLength) {
                return {
                  currentExerciseIndex: firstIndex,
                  currentSetIndices: updatedSetIndices,
                  completedSets: updatedCompletedSets,
                  weightAndReps: updatedWeightAndReps,
                };
              }

              // Superset fully done — find next uncompleted exercise after both
              const maxIndex = Math.max(currentExerciseIndex, firstIndex);
              let nextExerciseIndex = maxIndex + 1;
              while (nextExerciseIndex < workout.exercises.length) {
                const totalSets =
                  workout.exercises[nextExerciseIndex].sets.length;
                const isComplete =
                  updatedCompletedSets[nextExerciseIndex] &&
                  Object.keys(updatedCompletedSets[nextExerciseIndex])
                    .length === totalSets;
                if (!isComplete) break;
                nextExerciseIndex++;
              }

              if (nextExerciseIndex < workout.exercises.length) {
                return {
                  currentExerciseIndex: nextExerciseIndex,
                  currentSetIndices: updatedSetIndices,
                  completedSets: updatedCompletedSets,
                  weightAndReps: updatedWeightAndReps,
                };
              }

              router.back();
              return {
                currentSetIndices: updatedSetIndices,
                completedSets: updatedCompletedSets,
                weightAndReps: updatedWeightAndReps,
              };
            }
          }

          // --- Normal (non-superset) logic ---
          const isWarmup =
            currentExercise.sets[currentSetIndex]?.isWarmup || false;
          const isDropSet =
            currentExercise.sets[currentSetIndex]?.isDropSet || false;
          const isNextDropSet =
            nextSetIndex < currentExercise.sets.length &&
            currentExercise.sets[nextSetIndex]?.isDropSet;

          const updatedSetIndices = {
            ...currentSetIndices,
            [currentExerciseIndex]: nextSetIndex,
          };

          const previousExerciseData = previousWorkoutData
            ?.flatMap((workout) => workout.exercises)
            .find(
              (prevEx) => prevEx.exercise_id === currentExercise.exercise_id,
            );

          const currentSetValues =
            weightAndReps[currentExerciseIndex]?.[currentSetIndex] || {};
          const nextSetValues =
            previousExerciseData?.sets[nextSetIndex] || undefined;

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

          const updatedWeightAndReps = {
            ...weightAndReps,
            [currentExerciseIndex]: {
              ...(weightAndReps[currentExerciseIndex] || {}),
              [nextSetIndex]: updatedNextSetValues,
            },
          };

          if (nextSetIndex < currentExercise.sets.length) {
            return {
              currentSetIndices: updatedSetIndices,
              completedSets: updatedCompletedSets,
              weightAndReps: updatedWeightAndReps,
            };
          }

          let nextExerciseIndex = currentExerciseIndex + 1;
          while (nextExerciseIndex < workout.exercises.length) {
            const totalSets = workout.exercises[nextExerciseIndex].sets.length;
            const isExerciseCompleted =
              updatedCompletedSets[nextExerciseIndex] &&
              Object.keys(updatedCompletedSets[nextExerciseIndex]).length ===
                totalSets;

            if (!isExerciseCompleted) {
              return {
                currentExerciseIndex: nextExerciseIndex,
                currentSetIndices: updatedSetIndices,
                completedSets: updatedCompletedSets,
              };
            }
            nextExerciseIndex++;
          }

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

          // Re-index weightAndReps after deletion using shared helper
          const updatedWeightAndReps = { ...weightAndReps };
          if (updatedWeightAndReps[currentExerciseIndex]) {
            updatedWeightAndReps[currentExerciseIndex] = reindexAfterRemoval(
              updatedWeightAndReps[currentExerciseIndex],
              setIndex,
            );
          }

          // Re-index completedSets after deletion using shared helper
          const updatedCompletedSets = { ...completedSets };
          if (updatedCompletedSets[currentExerciseIndex]) {
            updatedCompletedSets[currentExerciseIndex] = reindexAfterRemoval(
              updatedCompletedSets[currentExerciseIndex],
              setIndex,
            );
          }

          // Navigate to the active set after deletion:
          // - first uncompleted set if the exercise still has one (the "active" set)
          // - last set if the exercise is fully completed (another exercise is active)
          const updatedSetIndices = { ...currentSetIndices };
          const totalSetsAfterRemoval =
            updatedExercises[currentExerciseIndex].sets.length;
          const updatedExerciseCompleted =
            updatedCompletedSets[currentExerciseIndex] || {};
          const isExerciseFullyCompleted = Array.from(
            { length: totalSetsAfterRemoval },
            (_, i) => i,
          ).every((i) => updatedExerciseCompleted[i] === true);
          if (isExerciseFullyCompleted) {
            updatedSetIndices[currentExerciseIndex] = totalSetsAfterRemoval - 1;
          } else {
            updatedSetIndices[currentExerciseIndex] =
              Array.from({ length: totalSetsAfterRemoval }, (_, i) => i).find(
                (i) => !updatedExerciseCompleted[i],
              ) ?? 0;
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

      appendExercise: (exercise) =>
        set((state) => {
          if (!state.workout) return state;
          const newIndex = state.workout.exercises.length;
          const updatedExercises = [...state.workout.exercises, exercise];
          return {
            workout: { ...state.workout, exercises: updatedExercises },
            appendedExerciseIndices: [
              ...state.appendedExerciseIndices,
              newIndex,
            ],
            completedSets: { ...state.completedSets, [newIndex]: {} },
            weightAndReps: { ...state.weightAndReps, [newIndex]: {} },
            currentSetIndices: { ...state.currentSetIndices, [newIndex]: 0 },
          };
        }),

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

      reorderExercises: (newExercises) => {
        set((state) => {
          const {
            workout,
            completedSets,
            weightAndReps,
            currentSetIndices,
            currentExerciseIndex,
            appendedExerciseIndices,
          } = state;
          if (!workout) return state;

          const oldExercises = workout.exercises;
          const oldToNew: { [oldIndex: number]: number } = {};
          for (let oldIdx = 0; oldIdx < oldExercises.length; oldIdx++) {
            const newIdx = newExercises.findIndex(
              (e) => e.exercise_id === oldExercises[oldIdx].exercise_id,
            );
            if (newIdx !== -1) oldToNew[oldIdx] = newIdx;
          }

          const remap = <T>(obj: {
            [key: number]: T;
          }): { [key: number]: T } => {
            const result: { [key: number]: T } = {};
            for (const [key, val] of Object.entries(obj)) {
              const oldIdx = parseInt(key, 10);
              const newIdx = oldToNew[oldIdx];
              if (newIdx !== undefined) result[newIdx] = val;
            }
            return result;
          };

          return {
            workout: { ...workout, exercises: newExercises },
            completedSets: remap(completedSets),
            weightAndReps: remap(weightAndReps),
            currentSetIndices: remap(currentSetIndices),
            currentExerciseIndex:
              oldToNew[currentExerciseIndex] ?? currentExerciseIndex,
            appendedExerciseIndices: appendedExerciseIndices
              .map((oldIdx) => oldToNew[oldIdx])
              .filter((idx): idx is number => idx !== undefined),
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
          appendedExerciseIndices: [],
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
          isQuickWorkout: false,
          currentExerciseIndex: 0,
          currentSetIndices: {},
          completedSets: {},
          weightAndReps: {},
          startTime: new Date(),
          timerRunning: false,
          timerExpiry: null,
          appendedExerciseIndices: [],
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
      getActiveWorkoutId: () => get().activeWorkout?.workoutId ?? null,
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
