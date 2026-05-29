import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setDeloadWeek } from "@/utils/database";

export const useDeloadWeekMutation = (planId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isoWeek: string | null) => setDeloadWeek(planId, isoWeek),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deloadWeek", planId] });
    },
  });
};
