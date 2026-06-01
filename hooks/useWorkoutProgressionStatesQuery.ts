import { useQuery } from "@tanstack/react-query";
import { getProgressionStatesForWorkout } from "@/utils/database";

export const useWorkoutProgressionStatesQuery = (
  workoutId: number | undefined,
) => {
  return useQuery({
    queryKey: ["workoutProgressionStates", workoutId],
    queryFn: () => getProgressionStatesForWorkout(workoutId!),
    enabled: workoutId != null && workoutId > 0,
    staleTime: 60 * 1000,
  });
};
