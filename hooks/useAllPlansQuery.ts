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
  sets: string | null;
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

    // Find or create the workout in the plan
    let workout = plan.workouts.find((w) => w.id === rawPlan.workout_id);
    if (!workout && rawPlan.workout_id && rawPlan.workout_name) {
      workout = {
        id: rawPlan.workout_id,
        name: rawPlan.workout_name,
        exercises: [],
      };
      plan.workouts.push(workout);
    }

    // Add exercise data to the workout
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
        sets: rawPlan.sets ? JSON.parse(rawPlan.sets) : [],
      });
    }

    // Ensure the plan is added to the list if not already present
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
