import { useQuery } from "@tanstack/react-query";
import { fetchCompletedWorkoutById } from "@/utils/database";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";

export const useCompletedWorkoutByIdQuery = (
  id: number,
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  return useQuery<CompletedWorkout>({
    queryKey: ["completedWorkout", id, weightUnit, distanceUnit],
    queryFn: () => fetchCompletedWorkoutById(id, weightUnit, distanceUnit),
    enabled: Number.isFinite(id) && id > 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};
