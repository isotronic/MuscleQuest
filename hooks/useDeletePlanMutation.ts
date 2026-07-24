import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWorkoutPlan } from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (planId: number) => deleteWorkoutPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["activePlan"] });
    },
    onError: (error: Error) => {
      notifyBugsnag(error);
      console.error("Failed to delete plan:", error);
    },
  });
}
