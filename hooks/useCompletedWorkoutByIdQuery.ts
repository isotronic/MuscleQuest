import { useQuery } from "@tanstack/react-query";
import { fetchCompletedWorkoutById } from "@/utils/database";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";

export const useCompletedWorkoutByIdQuery = (
  id: number,
  weightUnit: string,
) => {
  return useQuery<CompletedWorkout>({
    queryKey: ["completedWorkout", id, weightUnit],
    queryFn: () => fetchCompletedWorkoutById(id, weightUnit),
    enabled: Number.isFinite(id) && id > 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};
