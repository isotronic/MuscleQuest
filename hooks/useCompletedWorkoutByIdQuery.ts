import { useQuery } from "@tanstack/react-query";
import { fetchCompletedWorkoutById } from "@/utils/database";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";

export const useCompletedWorkoutByIdQuery = (
  id: number,
  weightUnit: string,
) => {
  return useQuery<CompletedWorkout>({
    queryKey: ["completedWorkout", id],
    queryFn: () => fetchCompletedWorkoutById(id, weightUnit),
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
};
