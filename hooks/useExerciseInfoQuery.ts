import { useQuery } from "@tanstack/react-query";
import { Exercise, fetchRecord } from "@/utils/database";
import { withDisplayName } from "@/utils/db/exerciseNames";

export const useExerciseInfoQuery = (exercise_id: number) => {
  return useQuery<Exercise>({
    queryKey: ["exercise-info", exercise_id],
    queryFn: async () => {
      const exercise = (await fetchRecord(
        "userData.db",
        "exercises",
        exercise_id,
      )) as unknown as Exercise | null;
      return (exercise ? withDisplayName(exercise) : exercise) as Exercise;
    },
    staleTime: 5 * 60 * 1000,
  });
};
