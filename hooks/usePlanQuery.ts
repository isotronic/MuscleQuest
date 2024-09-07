import { useQuery } from "@tanstack/react-query";
import { fetchRecord } from "@/utils/database";
import { Plan } from "./usePlans";

const fetchPlan = async (planId: number) => {
  try {
    const selectedPlan = (await fetchRecord(
      "userData.db",
      "user_plans",
      Number(planId),
    )) as Plan | null;

    if (
      selectedPlan &&
      typeof selectedPlan === "object" &&
      Object.keys(selectedPlan).length > 0
    ) {
      let parsedPlan = selectedPlan;

      if (typeof selectedPlan.plan_data === "string") {
        try {
          parsedPlan.plan_data = JSON.parse(selectedPlan.plan_data);
        } catch (jsonError) {
          console.error("Error parsing plan_data:", jsonError);
          return;
        }
      }

      return parsedPlan;
    } else if (selectedPlan === undefined) {
      return;
    } else {
      return;
    }
  } catch (error) {
    console.error("Error fetching plan", error);
  }
};

export const usePlanQuery = (planId: number) => {
  return useQuery<Plan>({
    queryKey: ["plan", planId],
    queryFn: () => fetchPlan(planId) as Promise<Plan>,
    staleTime: 5 * 60 * 1000,
  });
};
