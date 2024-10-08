import { useQuery } from "@tanstack/react-query";
import { fetchRecord, openDatabase } from "@/utils/database";
import { Plan } from "./useAllPlansQuery";

export interface WorkoutRecord {
  id: number;
  plan_id: number;
  name: string;
  workout_data: string;
}

const fetchPlanData = async (planId: number): Promise<Plan | null> => {
  return (await fetchRecord(
    "userData.db",
    "user_plans",
    Number(planId),
  )) as Plan | null;
};

const fetchWorkoutsForPlan = async (
  planId: number,
): Promise<WorkoutRecord[]> => {
  const db = await openDatabase("userData.db");
  return (await db.getAllAsync(
    `SELECT * FROM user_workouts WHERE plan_id = ?`,
    [planId],
  )) as WorkoutRecord[];
};

const parseWorkouts = (workouts: WorkoutRecord[]) => {
  try {
    return workouts.map((workout) => ({
      ...workout,
      exercises: JSON.parse(workout.workout_data),
    }));
  } catch (error) {
    console.error("Error parsing workout data:", error);
    return [];
  }
};

const fetchPlan = async (planId: number): Promise<Plan | null> => {
  try {
    const [planData, workouts] = await Promise.all([
      fetchPlanData(planId),
      fetchWorkoutsForPlan(planId),
    ]);

    if (!planData) {
      return null;
    }

    const parsedWorkouts = parseWorkouts(workouts);
    return {
      ...planData,
      workouts: parsedWorkouts,
    };
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
