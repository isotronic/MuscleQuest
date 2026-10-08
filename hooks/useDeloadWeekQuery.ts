import { useQuery } from "@tanstack/react-query";
import { getDeloadWeek } from "@/utils/database";
import { getCurrentISOWeek, getISOWeek } from "@/utils/isoWeek";

export const useDeloadWeekQuery = (planId: number | undefined) => {
  const query = useQuery({
    queryKey: ["deloadWeek", planId],
    queryFn: () => getDeloadWeek(planId!),
    enabled: planId != null && planId > 0,
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    isCurrentWeekDeload: query.data === getCurrentISOWeek(),
    // For a workout saved after the day it was trained.
    isDeloadWeekOf: (date: Date) =>
      query.data != null && query.data === getISOWeek(date),
  };
};
