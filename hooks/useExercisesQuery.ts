import { useQuery } from "@tanstack/react-query";
import { fetchAllRecords } from "@/utils/database";
import { Exercise } from "@/utils/database";

export const useExercisesQuery = () => {
  return useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: () =>
      fetchAllRecords("appData.db", "exercises") as Promise<Exercise[]>,
    staleTime: 5 * 60 * 1000,
  });
};
