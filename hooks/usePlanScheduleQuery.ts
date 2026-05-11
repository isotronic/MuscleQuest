import { useQuery } from "@tanstack/react-query";
import { fetchPlanSchedule, PlanScheduleEntry } from "@/utils/database";

export const usePlanScheduleQuery = (planId: number | null) => {
  return useQuery<PlanScheduleEntry[]>({
    queryKey: ["planSchedule", planId],
    queryFn: () => fetchPlanSchedule(planId!),
    enabled: planId !== null,
    staleTime: 5 * 60 * 1000,
  });
};
