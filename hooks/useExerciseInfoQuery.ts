import { useQuery } from "@tanstack/react-query";
import { Exercise, fetchRecord } from "@/utils/database";

export const useExerciseInfoQuery = (exercise_id: number) => {
  return useQuery<Exercise>({
    queryKey: ["exercise-info", exercise_id],
    queryFn: () =>
      fetchRecord(
        "userData.db",
        "exercises",
        exercise_id,
      ) as unknown as Exercise,
    staleTime: 5 * 60 * 1000,
  });
};
