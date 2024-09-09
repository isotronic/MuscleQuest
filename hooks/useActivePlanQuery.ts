import { useQuery } from "@tanstack/react-query";
import { Plan } from "./usePlans";
import { fetchActivePlan } from "@/utils/database";

const fetchAndParse = async () => {
  try {
    const activePlan = (await fetchActivePlan()) as Plan | null;

    if (
      activePlan &&
      typeof activePlan === "object" &&
      Object.keys(activePlan).length > 0
    ) {
      let parsedPlan = activePlan;

      if (typeof activePlan.plan_data === "string") {
        try {
          parsedPlan.plan_data = JSON.parse(activePlan.plan_data);
        } catch (jsonError) {
          console.error("Error parsing plan_data:", jsonError);
          return;
        }
      }

      return parsedPlan;
    } else if (activePlan === undefined) {
      return;
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching plan", error);
  }
};

export const useActivePlanQuery = () => {
  return useQuery<Plan>({
    queryKey: ["activePlan"],
    queryFn: () => fetchAndParse() as Promise<Plan>,
    staleTime: Infinity,
  });
};
