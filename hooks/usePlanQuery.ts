import { useQuery } from "@tanstack/react-query";
import { fetchRecord, openDatabase } from "@/utils/database";
import { Plan } from "./useAllPlansQuery";

export interface WorkoutRecord {
  id: number;
  plan_id: number;
  name: string;
  workout_data: string;
}

const fetchPlan = async (planId: number): Promise<Plan | null> => {
  try {
    // Fetch the plan data from the `user_plans` table
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
      // Fetch the workouts associated with the plan
      const db = await openDatabase("userData.db");
      const workouts = (await db.getAllAsync(
        `SELECT * FROM user_workouts WHERE plan_id = ?`,
        [planId],
      )) as WorkoutRecord[];

      // Parse the workout data from JSON strings
      const parsedWorkouts = workouts.map((workout) => ({
        ...workout,
        exercises: JSON.parse(workout.workout_data),
      }));

      // Return the plan with the parsed workouts
      return {
        ...selectedPlan,
        workouts: parsedWorkouts,
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching plan", error);
    return null;
  }
};

export const usePlanQuery = (planId: number | null) => {
  return useQuery<Plan | null>({
    queryKey: ["plan", planId],
    queryFn: () => fetchPlan(planId!) as Promise<Plan | null>,
    staleTime: 5 * 60 * 1000,
    enabled: !!planId, // Only run the query if planId exists
  });
};
