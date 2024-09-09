import { fetchAllRecords } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { useQuery } from "@tanstack/react-query";

export interface Plan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  plan_data: Workout[];
}

const fetchPlans = async (): Promise<Plan[]> => {
  try {
    return (await fetchAllRecords("userData.db", "user_plans")) as Plan[];
  } catch (error) {
    console.error("Error fetching plans", error);
    throw new Error("Failed to fetch plans");
  }
};

export const useAllPlansQuery = () => {
  return useQuery<Plan[], Error>({
    queryKey: ["plans"],
    queryFn: fetchPlans,
    staleTime: Infinity,
  });
};
