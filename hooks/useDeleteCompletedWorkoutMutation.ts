import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { router } from "expo-router";
import { deleteCompletedWorkout } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

export const useDeleteCompletedWorkoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCompletedWorkout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      router.back();
    },
    onError: (error: any) => {
      console.error("Error deleting workout:", error);
      Bugsnag.notify(error);
      Alert.alert("Error", "Failed to delete the workout. Please try again.");
    },
  });
};
