import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlanSchedule,
  updateActivePlan,
  updateSettings,
} from "@/utils/database";

export const useSetActivePlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: number) => updateActivePlan(planId),
    onSuccess: async (_, planId) => {
      // Sync weeklyGoal to the number of scheduled days in the newly-activated plan
      try {
        const schedule = await fetchPlanSchedule(planId);
        if (schedule.length > 0) {
          await updateSettings("weeklyGoal", String(schedule.length));
          queryClient.invalidateQueries({ queryKey: ["settings"] });
        }
      } catch (_err) {
        // Non-critical: don't block UI if schedule fetch fails
      }
      queryClient.invalidateQueries({ queryKey: ["activePlan"] });
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
};
