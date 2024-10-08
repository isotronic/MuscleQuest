import { openDatabase } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { useQuery } from "@tanstack/react-query";

export interface Plan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  workouts: Workout[];
}

interface RawPlan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  workout_id: number | null;
  workout_name: string | null;
  workout_data: string | null;
}

const fetchPlans = async (): Promise<Plan[]> => {
  try {
    const db = await openDatabase("userData.db");

    // Perform a LEFT JOIN to get plans and their associated workouts
    const rawPlans = (await db.getAllAsync(`
      SELECT 
        user_plans.id, 
        user_plans.name, 
        user_plans.image_url, 
        user_plans.is_active, 
        user_workouts.id AS workout_id, 
        user_workouts.name AS workout_name, 
        user_workouts.workout_data 
      FROM user_plans
      LEFT JOIN user_workouts ON user_workouts.plan_id = user_plans.id
    `)) as RawPlan[];

    // Transform the raw data into the desired structure
    const plansMap = new Map<number, Plan>();

    rawPlans.forEach((rawPlan) => {
      // Get or create the plan entry in the map
      if (!plansMap.has(rawPlan.id)) {
        plansMap.set(rawPlan.id, {
          id: rawPlan.id,
          name: rawPlan.name,
          image_url: rawPlan.image_url,
          is_active: rawPlan.is_active,
          workouts: [],
        });
      }

      // If there's workout data, add the workout to the plan's workouts array
      if (rawPlan.workout_id && rawPlan.workout_name && rawPlan.workout_data) {
        const plan = plansMap.get(rawPlan.id)!;
        plan.workouts.push({
          id: rawPlan.workout_id,
          name: rawPlan.workout_name,
          exercises: JSON.parse(rawPlan.workout_data),
        });
      }
    });

    // Convert the map values back to an array
    return Array.from(plansMap.values());
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
