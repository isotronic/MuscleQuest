import { useQuery } from "@tanstack/react-query";
import { fetchAllRecords } from "@/utils/database";
import { Exercise } from "@/utils/database";

export const useExercises = () => {
  return useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: () => fetchAllRecords("appData.db", "exercises"),
    staleTime: 5 * 60 * 1000,
  });
};
