import { useQuery } from "@tanstack/react-query";
import { getDeloadWeek } from "@/utils/database";
import { useWeekRule } from "@/hooks/useWeekRule";
import { isDeloadWeek } from "@/utils/deloadWeek";

export const useDeloadWeekQuery = (planId: number | undefined) => {
  const weekRule = useWeekRule();
  const query = useQuery({
    queryKey: ["deloadWeek", planId],
    queryFn: () => getDeloadWeek(planId!),
    enabled: planId != null && planId > 0,
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    isCurrentWeekDeload: isDeloadWeek(query.data, new Date(), weekRule),
    // For a workout saved after the day it was trained.
    isDeloadWeekOf: (date: Date) => isDeloadWeek(query.data, date, weekRule),
  };
};
