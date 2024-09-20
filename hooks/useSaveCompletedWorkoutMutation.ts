import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveCompletedWorkout, SavedWorkout } from "@/utils/database";

export const useSaveCompletedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (completedWorkoutData: SavedWorkout) => {
      return saveCompletedWorkout(
        completedWorkoutData.planId,
        completedWorkoutData.workoutName,
        completedWorkoutData.duration,
        completedWorkoutData.totalSetsCompleted,
        completedWorkoutData.exercises,
      );
    },
    onSuccess: () => {
      // Invalidate the 'completedWorkouts' query to refetch the data
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
    },
  });
};
