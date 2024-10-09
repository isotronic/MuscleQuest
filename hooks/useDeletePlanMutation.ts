import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWorkoutPlan } from "@/utils/database";

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (planId: number) => deleteWorkoutPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["activePlan"] });
    },
    onError: (error: Error) => {
      console.error("Failed to delete plan:", error);
    },
  });
}
