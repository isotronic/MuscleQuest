import { useQuery } from "@tanstack/react-query";
import { getStandaloneWorkouts } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export const fetchStandaloneWorkouts = async (): Promise<Workout[]> => {
  try {
    return await getStandaloneWorkouts();
  } catch (error: any) {
    Bugsnag.notify(error);
    throw error;
  }
};

export const useStandaloneWorkoutsQuery = () => {
  return useQuery<Workout[], Error>({
    queryKey: ["standaloneWorkouts"],
    queryFn: fetchStandaloneWorkouts,
    staleTime: 5 * 60 * 1000,
  });
};
