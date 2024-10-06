import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCompletedWorkout, SavedWorkout } from "@/utils/database";

const saveCompletedWorkoutWithConversion = async (
  completedWorkoutData: SavedWorkout,
  weightUnit: string,
) => {
  const conversionFactor = weightUnit === "lbs" ? 0.45359237 : 1; // lbs to kg

  // Deep copy to avoid mutating the original data
  const workoutDataInKg = {
    ...completedWorkoutData,
    exercises: completedWorkoutData.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        weight: set.weight * conversionFactor,
      })),
    })),
  };

  return saveCompletedWorkout(
    workoutDataInKg.planId,
    workoutDataInKg.workoutName,
    workoutDataInKg.duration,
    workoutDataInKg.totalSetsCompleted,
    workoutDataInKg.exercises,
  );
};

export const useSaveCompletedWorkoutMutation = (weightUnit: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (completedWorkoutData: SavedWorkout) => {
      return saveCompletedWorkoutWithConversion(
        completedWorkoutData,
        weightUnit,
      );
    },
    onSuccess: () => {
      // Invalidate the 'completedWorkouts' query to refetch the data
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
    },
  });
};
