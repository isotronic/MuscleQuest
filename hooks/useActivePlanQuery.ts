import { useQuery } from "@tanstack/react-query";
import { Plan } from "./useAllPlansQuery";
import { fetchActivePlan } from "@/utils/database";

const fetchAndParse = async (): Promise<Plan | null> => {
  try {
    const activePlan = (await fetchActivePlan()) as Plan | undefined;

    if (
      !activePlan ||
      typeof activePlan !== "object" ||
      Object.keys(activePlan).length === 0
    ) {
      return null;
    }

    return {
      ...activePlan,
      plan_data:
        typeof activePlan.plan_data === "string"
          ? JSON.parse(activePlan.plan_data)
          : activePlan.plan_data,
    };
  } catch (error) {
    console.error("Error fetching or parsing plan", error);
    return null;
  }
};

export const useActivePlanQuery = () => {
  return useQuery<Plan | null>({
    queryKey: ["activePlan"],
    queryFn: fetchAndParse,
    staleTime: Infinity,
  });
};
