import { openDatabase } from "@/utils/database";
import { Workout } from "@/store/workoutStore";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

export interface Plan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  app_plan_id?: number | null;
  is_deleted?: boolean;
  workouts: Workout[];
}

export interface RawPlan {
  id: number;
  name: string;
  image_url: string;
  is_active: number;
  app_plan_id: number | null;
  workout_id: number | null;
  workout_name: string | null;
  exercise_id: number | null;
  exercise_name: string | null;
  description: string | null;
  image: Uint8Array | null;
  local_animated_uri: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  sets: string | null;
  exercise_order: number | null;
}

const transformRawPlans = (
  rawPlans: RawPlan[],
): { userPlans: Plan[]; appPlans: Plan[] } => {
  const userPlansMap = new Map<number, Plan>();
  const appPlansMap = new Map<number, Plan>();

  for (const rawPlan of rawPlans) {
    // Determine which map to use based on `app_plan_id`
    const plansMap = rawPlan.app_plan_id ? appPlansMap : userPlansMap;

    let plan = plansMap.get(rawPlan.id);
    if (!plan) {
      plan = {
        id: rawPlan.id,
        name: rawPlan.name,
        image_url: rawPlan.image_url,
        is_active: rawPlan.is_active,
        app_plan_id: rawPlan.app_plan_id,
        workouts: [],
      };
      plansMap.set(rawPlan.id, plan);
    }

    let workout = plan.workouts.find((w) => w.id === rawPlan.workout_id);
    if (!workout && rawPlan.workout_id && rawPlan.workout_name) {
      workout = {
        id: rawPlan.workout_id,
        name: rawPlan.workout_name,
        exercises: [],
      };
      plan.workouts.push(workout);
    }

    if (workout && rawPlan.exercise_id && rawPlan.exercise_name) {
      workout.exercises.push({
        exercise_id: rawPlan.exercise_id,
        name: rawPlan.exercise_name,
        description: rawPlan.description || "",
        image: rawPlan.image ? Array.from(rawPlan.image) : [],
        local_animated_uri: rawPlan.local_animated_uri || "",
        animated_url: rawPlan.animated_url || "",
        equipment: rawPlan.equipment || "",
        body_part: rawPlan.body_part || "",
        target_muscle: rawPlan.target_muscle || "",
        secondary_muscles: rawPlan.secondary_muscles
          ? JSON.parse(rawPlan.secondary_muscles)
          : [],
        tracking_type: rawPlan.tracking_type || "",
        sets: rawPlan.sets ? JSON.parse(rawPlan.sets) : [],
      });
    }
  }

  // Convert Maps to arrays
  return {
    userPlans: Array.from(userPlansMap.values()).reverse(),
    appPlans: Array.from(appPlansMap.values()),
  };
};

const fetchPlans = async (): Promise<{
  userPlans: Plan[];
  appPlans: Plan[];
}> => {
  try {
    const db = await openDatabase("userData.db");
    const rawPlans = (await db.getAllAsync(`
      SELECT 
        user_plans.id, 
        user_plans.name, 
        user_plans.image_url, 
        user_plans.is_active, 
        user_plans.app_plan_id,
        user_workouts.id AS workout_id, 
        user_workouts.name AS workout_name, 
        user_workout_exercises.id AS exercise_id,
        exercises.name AS exercise_name,
        exercises.description,
        exercises.image,
        exercises.local_animated_uri,
        exercises.animated_url,
        exercises.equipment,
        exercises.body_part,
        exercises.target_muscle,
        exercises.secondary_muscles,
        exercises.tracking_type,
        user_workout_exercises.sets,
        user_workout_exercises.exercise_order
      FROM user_plans
      LEFT JOIN user_workouts ON user_workouts.plan_id = user_plans.id
      LEFT JOIN user_workout_exercises ON user_workout_exercises.workout_id = user_workouts.id
      LEFT JOIN exercises ON exercises.exercise_id = user_workout_exercises.exercise_id
      WHERE user_plans.is_deleted = FALSE
        AND (user_workouts.is_deleted = FALSE OR user_workouts.is_deleted IS NULL)
        AND (user_workout_exercises.is_deleted = FALSE OR user_workout_exercises.is_deleted IS NULL)
      ORDER BY user_plans.id, user_workouts.id, user_workout_exercises.exercise_order ASC
    `)) as RawPlan[];

    return transformRawPlans(rawPlans);
  } catch (error: any) {
    console.error("Error fetching plans", error);
    Bugsnag.notify(error);
    throw new Error("Failed to fetch plans");
  }
};

export const useAllPlansQuery = () => {
  return useQuery<{ userPlans: Plan[]; appPlans: Plan[] }, Error>({
    queryKey: ["plans"],
    queryFn: fetchPlans,
    staleTime: 5 * 60 * 1000,
  });
};
