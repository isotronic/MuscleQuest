import { useQuery } from "@tanstack/react-query";
import { Plan, RawPlan } from "./useAllPlansQuery";
import { openDatabase } from "@/utils/database";

const fetchActivePlanData = async (): Promise<Plan | null> => {
  try {
    const db = await openDatabase("userData.db");

    // Fetch the active plan along with its associated workouts and exercises using a LEFT JOIN
    const rawResult = (await db.getAllAsync(
      `
      SELECT 
        user_plans.id, 
        user_plans.name, 
        user_plans.image_url, 
        user_plans.is_active, 
        user_workouts.id AS workout_id, 
        user_workouts.name AS workout_name, 
        user_workout_exercises.id AS exercise_id,
        user_workout_exercises.name AS exercise_name,
        user_workout_exercises.description,
        user_workout_exercises.image,
        user_workout_exercises.local_animated_uri,
        user_workout_exercises.animated_url,
        user_workout_exercises.equipment,
        user_workout_exercises.body_part,
        user_workout_exercises.target_muscle,
        user_workout_exercises.secondary_muscles,
        user_workout_exercises.sets
      FROM user_plans
      LEFT JOIN user_workouts ON user_workouts.plan_id = user_plans.id
      LEFT JOIN user_workout_exercises ON user_workout_exercises.workout_id = user_workouts.id
      WHERE user_plans.is_active = 1
      `,
    )) as RawPlan[] | null;

    if (!rawResult || rawResult.length === 0) {
      return null; // No active plan found
    }

    const { id, name, image_url, is_active } = rawResult[0];

    // Group workouts and their exercises under the active plan
    const workouts = rawResult.reduce(
      (acc, row) => {
        // Find the existing workout by its id
        let workout = acc.find((w) => w.id === row.workout_id);

        // If no workout exists with this ID, create a new one
        if (!workout && row.workout_id) {
          workout = {
            id: row.workout_id,
            //plan_id: row.id,
            name: row.workout_name || "",
            exercises: [],
          };
          acc.push(workout);
        }

        // If a workout exists, add exercises to it
        if (workout && row.exercise_id) {
          workout.exercises.push({
            exercise_id: row.exercise_id,
            name: row.exercise_name || "Unnamed Exercise",
            description: row.description || "",
            image: row.image ? Array.from(row.image) : [],
            local_animated_uri: row.local_animated_uri || "",
            animated_url: row.animated_url || "",
            equipment: row.equipment || "",
            body_part: row.body_part || "",
            target_muscle: row.target_muscle || "",
            secondary_muscles: row.secondary_muscles
              ? JSON.parse(row.secondary_muscles)
              : [],
            sets: row.sets ? JSON.parse(row.sets) : [],
          });
        }

        return acc;
      },
      [] as Plan["workouts"],
    );

    // Construct the plan object with the associated workouts
    return {
      id: id,
      name: name,
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
    queryFn: fetchActivePlanData,
    staleTime: Infinity,
  });
};
