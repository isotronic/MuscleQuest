import { useQuery } from "@tanstack/react-query";
import { getPendingRecoveryCheckIns } from "@/utils/database";

export const usePendingRecoveryQuery = (workoutId: number | undefined) => {
  return useQuery({
    queryKey: ["pendingRecovery", workoutId],
    queryFn: () => getPendingRecoveryCheckIns(workoutId!),
    enabled: workoutId != null && workoutId > 0,
    staleTime: 0,
  });
};
