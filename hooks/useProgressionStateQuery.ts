import { useQuery } from "@tanstack/react-query";
import { getProgressionState } from "@/utils/database";

export const useProgressionStateQuery = (
  userWorkoutExerciseId: number | undefined,
) => {
  return useQuery({
    queryKey: ["progressionState", userWorkoutExerciseId],
    queryFn: () => getProgressionState(userWorkoutExerciseId!),
    enabled: userWorkoutExerciseId != null && userWorkoutExerciseId > 0,
    staleTime: 5 * 60 * 1000,
  });
};
