import { useQuery } from "@tanstack/react-query";
import { Plan, RawPlan } from "./useAllPlansQuery";
import { openDatabase } from "@/utils/database";

const fetchAndParse = async (): Promise<Plan | null> => {
  try {
    const db = await openDatabase("userData.db");

    // Fetch the active plan along with its associated workouts using a LEFT JOIN
    const rawResult = (await db.getAllAsync(
      `SELECT 
        user_plans.id, 
        user_plans.name, 
        user_plans.image_url, 
        user_plans.is_active, 
        user_workouts.id AS workout_id, 
        user_workouts.name AS workout_name, 
        user_workouts.workout_data
      FROM user_plans
      LEFT JOIN user_workouts ON user_workouts.plan_id = user_plans.id
      WHERE user_plans.is_active = 1`,
    )) as RawPlan[] | null;

    if (!rawResult) {
      return null; // No active plan found
    }

    // Extract the plan details
    const { id, name, image_url, is_active } = rawResult[0];

    // Group workouts under the active plan if any exist
    const workouts = rawResult
      .filter((row) => row.workout_id !== null)
      .map((row) => ({
        id: row.workout_id!,
        name: row.workout_name!,
        exercises: JSON.parse(row.workout_data!),
      }));

    // Construct the plan object with the associated workouts
    return {
      id,
      name,
      image_url,
      is_active,
      workouts,
    };
  } catch (error) {
    console.error("Error fetching or parsing active plan", error);
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
