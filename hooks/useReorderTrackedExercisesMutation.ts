import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { reorderTrackedExercises } from "@/utils/database";

export const useReorderTrackedExercisesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exerciseIds: number[]) => reorderTrackedExercises(exerciseIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    },
    onError: (error: Error) => {
      console.error("Failed to reorder tracked exercises:", error);
      Bugsnag.notify(error);
    },
  });
};
