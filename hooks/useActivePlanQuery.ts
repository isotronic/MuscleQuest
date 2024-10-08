import { useQuery } from "@tanstack/react-query";
import { Plan } from "./useAllPlansQuery";
import { fetchActivePlan, openDatabase } from "@/utils/database";
import { WorkoutRecord } from "./usePlanQuery";

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

    const db = await openDatabase("userData.db");

    // Fetch workouts associated with the active plan
    const workouts = (await db.getAllAsync(
      `SELECT * FROM user_workouts WHERE plan_id = ?`,
      [activePlan.id],
    )) as WorkoutRecord[];

    // Parse the workout data from JSON strings
    const parsedWorkouts = workouts.map((workout) => ({
      ...workout,
      exercises: JSON.parse(workout.workout_data),
    }));

    return {
      ...activePlan,
      workouts: parsedWorkouts,
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
