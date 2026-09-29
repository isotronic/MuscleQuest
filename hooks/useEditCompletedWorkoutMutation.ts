import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";
import { Alert } from "react-native";
import { openDatabase } from "@/utils/database";
import type { SQLiteDatabase } from "expo-sqlite";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { displayToKg, displayToMetres, roundCanonical } from "@/utils/units";

const saveCompletedWorkoutWithConversion = async (
  completedWorkoutData: CompletedWorkout["exercises"],
  weightUnit: string,
  distanceUnit: string,
) => {
  // Deep copy to avoid mutating the original data. Rounded so the same input
  // always stores the same value; see roundCanonical.
  const workoutDataConverted = completedWorkoutData.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      weight: set.weight
        ? roundCanonical(displayToKg(set.weight, weightUnit))
        : 0,
      reps: set.reps || 0,
      time: set.time || 0,
      distance:
        set.distance != null
          ? roundCanonical(displayToMetres(set.distance, distanceUnit))
          : null,
    })),
  }));

  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const exercise of workoutDataConverted) {
        await txn.runAsync(
          `UPDATE completed_exercises SET exercise_id = ?, resolved_tracking_type = ? WHERE id = ?`,
          [
            exercise.exercise_id,
            exercise.exercise_tracking_type,
            exercise.completed_exercise_id,
          ],
        );
        for (const set of exercise.sets) {
          await txn.runAsync(
            `UPDATE completed_sets SET weight = ?, reps = ?, time = ?, distance = ? WHERE id = ? AND set_number = ?`,
            [
              set.weight,
              set.reps,
              set.time,
              set.distance,
              set.set_id,
              set.set_number,
            ],
          );
        }
      }
    });
  } catch (error: any) {
    console.error("Error saving edited workout:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
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
      queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      queryClient.invalidateQueries({ queryKey: ["workoutSessionHistory"] });
      queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession"],
      });
    },
    onError: (error) => {
      console.error("Error saving edited workout:", error);
      notifyBugsnag(error);
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
      await queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
      await queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      await queryClient.invalidateQueries({
        queryKey: ["workoutSessionHistory"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession"],
      });
    },
  });
};
