import { useQuery } from "@tanstack/react-query";
import { isExercisePinned } from "@/utils/database";

// Under "trackedExercises" so every pin change refreshes it.
export const useIsExercisePinnedQuery = (exerciseId: number) =>
  useQuery<boolean>({
    queryKey: ["trackedExercises", "pinned", exerciseId],
    queryFn: () => isExercisePinned(exerciseId),
    enabled: exerciseId > 0,
  });
