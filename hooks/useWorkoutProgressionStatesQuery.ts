import { useQuery } from "@tanstack/react-query";
import { getProgressionStatesForWorkout } from "@/utils/database";

export const useWorkoutProgressionStatesQuery = (
  workoutId: number | undefined,
  skipLayoffOverride = false,
) => {
  return useQuery({
    queryKey: ["workoutProgressionStates", workoutId, skipLayoffOverride],
    queryFn: () =>
      getProgressionStatesForWorkout(workoutId!, skipLayoffOverride),
    enabled: workoutId != null && workoutId > 0,
    staleTime: 60 * 1000,
  });
};
