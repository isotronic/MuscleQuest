import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateActivePlan } from "@/utils/database";

export const useSetActivePlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => updateActivePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activePlan"] });
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
};
