import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { reorderTrackedExercises } from "@/utils/database";

export const useReorderTrackedExercisesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number[]>({
    mutationFn: (exerciseIds: number[]) => reorderTrackedExercises(exerciseIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
    },
    onError: (error: Error) => {
      console.error("Failed to reorder tracked exercises:", error);
      notifyBugsnag(error);
    },
  });
};
