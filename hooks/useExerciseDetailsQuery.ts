import { useQuery } from "@tanstack/react-query";
import { Exercise, fetchRecord } from "@/utils/database";

export const useExerciseDetailsQuery = (exercise_id: number) => {
  return useQuery<Exercise>({
    queryKey: ["exerciseDetails", exercise_id],
    queryFn: () =>
      fetchRecord(
        "userData.db",
        "exercises",
        exercise_id,
      ) as unknown as Exercise,
    staleTime: Infinity,
  });
};
