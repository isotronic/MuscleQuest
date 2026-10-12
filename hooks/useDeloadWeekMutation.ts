import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setDeloadWeek } from "@/utils/database";

export const useDeloadWeekMutation = (planId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    // A week key from deloadWeekKey, or null to end the deload.
    mutationFn: (weekKey: string | null) => setDeloadWeek(planId, weekKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deloadWeek", planId] });
    },
  });
};
