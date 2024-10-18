import { useQuery } from "@tanstack/react-query";
import { Plan, RawPlan } from "./useAllPlansQuery";
import { openDatabase } from "@/utils/database";
import { Workout } from "@/store/workoutStore";

const fetchActivePlanData = async (): Promise<Plan | null> => {
  try {
    const db = await openDatabase("userData.db");

    const rawResult = (await db.getAllAsync(
      `
      SELECT 
        user_plans.id, 
        user_plans.name, 
        user_plans.image_url, 
        user_plans.is_active, 
        user_workouts.id AS workout_id, 
        user_workouts.name AS workout_name, 
        user_workout_exercises.exercise_id AS exercise_id,
        exercises.name AS exercise_name,
        exercises.description,
        exercises.image,
        exercises.local_animated_uri,
        exercises.animated_url,
        exercises.equipment,
        exercises.body_part,
        exercises.target_muscle,
        exercises.secondary_muscles,
        user_workout_exercises.sets,
        user_workout_exercises.exercise_order
      FROM user_plans
      LEFT JOIN user_workouts ON user_workouts.plan_id = user_plans.id
      LEFT JOIN user_workout_exercises ON user_workout_exercises.workout_id = user_workouts.id
      LEFT JOIN exercises ON exercises.exercise_id = user_workout_exercises.exercise_id
      WHERE user_plans.is_active = 1
      ORDER BY user_workouts.id, user_workout_exercises.exercise_order ASC
      `,
    )) as RawPlan[] | null;

    if (!rawResult || rawResult.length === 0) {
      return null; // No active plan found
    }

    const workoutsMap = new Map<number, Workout>();

    for (const row of rawResult) {
      let workout = workoutsMap.get(row.workout_id!);
      if (!workout && row.workout_id) {
        workout = {
          id: row.workout_id,
          name: row.workout_name || "",
          exercises: [],
        };
        workoutsMap.set(row.workout_id, workout);
      }

      if (workout && row.exercise_id && row.exercise_name) {
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
    }

    const workouts = Array.from(workoutsMap.values());

    return {
      id: rawResult[0].id,
      name: rawResult[0].name,
      image_url: rawResult[0].image_url,
      is_active: rawResult[0].is_active,
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
