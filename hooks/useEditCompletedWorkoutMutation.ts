import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";
import { Alert } from "react-native";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

const saveCompletedWorkoutWithConversion = async (
  completedWorkoutData: CompletedWorkout["exercises"],
  weightUnit: string,
  distanceUnit: string,
) => {
  const conversionFactor = weightUnit === "lbs" ? 0.45359237 : 1;
  const distanceConversionFactor = distanceUnit === "ft" ? 0.3048 : 1;

  // Deep copy to avoid mutating the original data
  const workoutDataConverted = completedWorkoutData.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      weight: set.weight ? set.weight * conversionFactor : 0,
      reps: set.reps || 0,
      time: set.time || 0,
      distance:
        set.distance != null ? set.distance * distanceConversionFactor : null,
    })),
  }));

  try {
    const db = await openDatabase("userData.db");
    for (const exercise of workoutDataConverted) {
      for (const set of exercise.sets) {
        await db.runAsync(
          `UPDATE completed_sets SET weight = ?, reps = ?, time = ?, distance = ? WHERE id = ? AND set_number = ?`,
          [set.weight, set.reps, set.time, set.distance, set.set_id, set.set_number],
        );
      }
    }
  } catch (error: any) {
    console.error("Error saving edited workout:", error);
    Bugsnag.notify(error);
    throw error;
  }
};

export const useEditCompletedWorkoutMutation = (
  id: number,
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (completedWorkoutData: CompletedWorkout["exercises"]) => {
      return await saveCompletedWorkoutWithConversion(
        completedWorkoutData,
        weightUnit,
        distanceUnit,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completedWorkout", id] });
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    },
    onError: (error) => {
      console.error("Error saving edited workout:", error);
      Bugsnag.notify(error);
      Alert.alert(
        "Error",
        "An error occurred while saving your edited workout. Please try again.",
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["completedWorkout", id],
      });
      await queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      await queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    },
  });
};
