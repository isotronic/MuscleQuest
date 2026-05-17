import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCompletedWorkout, SavedWorkout } from "@/utils/database";

const saveCompletedWorkoutWithConversion = async (
  completedWorkoutData: SavedWorkout,
  weightUnit: string,
  distanceUnit: string,
) => {
  const weightConversionFactor = weightUnit === "lbs" ? 0.45359237 : 1;
  const distanceConversionFactor = distanceUnit === "ft" ? 0.3048 : 1;

  const workoutDataConverted = {
    ...completedWorkoutData,
    exercises: completedWorkoutData.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        weight: (set.weight || 0) * weightConversionFactor,
        distance: set.distance != null ? set.distance * distanceConversionFactor : null,
      })),
    })),
  };

  return saveCompletedWorkout(
    workoutDataConverted.planId,
    workoutDataConverted.workoutId,
    workoutDataConverted.duration,
    workoutDataConverted.totalSetsCompleted,
    workoutDataConverted.exercises,
  );
};

export const useSaveCompletedWorkoutMutation = (weightUnit: string, distanceUnit: string = "m") => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (completedWorkoutData: SavedWorkout) => {
      return saveCompletedWorkoutWithConversion(
        completedWorkoutData,
        weightUnit,
        distanceUnit,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    },
  });
};
