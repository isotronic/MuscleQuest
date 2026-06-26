import { useQuery } from "@tanstack/react-query";
import { getProgressionState } from "@/utils/database";

export const useProgressionStateQuery = (
  userWorkoutExerciseId: number | undefined,
  skipLayoffOverride = false,
) => {
  return useQuery({
    queryKey: ["progressionState", userWorkoutExerciseId, skipLayoffOverride],
    queryFn: () =>
      getProgressionState(userWorkoutExerciseId!, skipLayoffOverride),
    enabled: userWorkoutExerciseId != null && userWorkoutExerciseId > 0,
    staleTime: 5 * 60 * 1000,
  });
};
