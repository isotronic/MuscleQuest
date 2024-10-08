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

export interface RawPlan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  workout_id: number | null;
  workout_name: string | null;
  workout_data: string | null;
}

const transformRawPlans = (rawPlans: RawPlan[]): Plan[] => {
  return rawPlans.reduce((plans, rawPlan) => {
    const plan = plans.find((p) => p.id === rawPlan.id) || {
      id: rawPlan.id,
      name: rawPlan.name,
      image_url: rawPlan.image_url,
      is_active: rawPlan.is_active,
      workouts: [],
    };

    if (rawPlan.workout_id && rawPlan.workout_name && rawPlan.workout_data) {
      plan.workouts.push({
        id: rawPlan.workout_id,
        name: rawPlan.workout_name,
        exercises: JSON.parse(rawPlan.workout_data),
      });
    }

    if (!plans.find((p) => p.id === rawPlan.id)) {
      plans.push(plan);
    }

    return plans;
  }, [] as Plan[]);
};

const fetchPlans = async (): Promise<Plan[]> => {
  try {
    const db = await openDatabase("userData.db");
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
    return transformRawPlans(rawPlans);
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
