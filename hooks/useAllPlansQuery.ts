import { openDatabase } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { useQuery } from "@tanstack/react-query";
import { WorkoutRecord } from "./usePlanQuery";

export interface Plan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  workouts: Workout[];
}

const fetchPlans = async (): Promise<Plan[]> => {
  try {
    const db = await openDatabase("userData.db");

    // Fetch all plans from the `user_plans` table
    const plans = (await db.getAllAsync(`SELECT * FROM user_plans`)) as Plan[];

    // Fetch workouts for each plan and attach them to the respective plan
    const plansWithWorkouts = await Promise.all(
      plans.map(async (plan) => {
        const workouts = (await db.getAllAsync(
          `SELECT * FROM user_workouts WHERE plan_id = ?`,
          [plan.id],
        )) as WorkoutRecord[];

        // Parse the workout data
        const parsedWorkouts = workouts.map((workout) => ({
          ...workout,
          exercises: JSON.parse(workout.workout_data),
        }));

        return {
          ...plan,
          workouts: parsedWorkouts,
        };
      }),
    );

    return plansWithWorkouts;
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
