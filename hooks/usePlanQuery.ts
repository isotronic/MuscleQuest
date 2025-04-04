import { useQuery } from "@tanstack/react-query";
import { fetchRecord, openDatabase } from "@/utils/database";
import { Plan } from "./useAllPlansQuery";
import Bugsnag from "@bugsnag/expo";

export interface WorkoutRecord {
  id: number;
  plan_id: number;
  name: string;
  exercises: {
    exercise_id: number;
    name: string;
    description: string;
    image: number[];
    local_animated_uri: string;
    animated_url: string;
    equipment: string;
    body_part: string;
    target_muscle: string;
    secondary_muscles: string[];
    tracking_type: string;
    sets: {
      repsMin: number;
      repsMax: number;
      restMinutes: number;
      restSeconds: number;
      time: number;
      isWarmup: boolean;
      toFailure: boolean;
    }[];
  }[];
}

export interface RawWorkoutRecord {
  id: number;
  plan_id: number;
  name: string;
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

const fetchPlanData = async (planId: number): Promise<Plan | null> => {
  return (await fetchRecord(
    "userData.db",
    "user_plans",
    Number(planId),
  )) as Plan | null;
};

const fetchWorkoutsForPlan = async (
  planId: number,
): Promise<RawWorkoutRecord[]> => {
  const db = await openDatabase("userData.db");

  try {
    const rawWorkouts = (await db.getAllAsync(
      `
      SELECT 
        user_workouts.id,
        user_workouts.plan_id,
        user_workouts.name,
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
        exercises.tracking_type,
        user_workout_exercises.sets,
        user_workout_exercises.exercise_order
      FROM user_workouts
      LEFT JOIN user_workout_exercises ON user_workout_exercises.workout_id = user_workouts.id
      LEFT JOIN exercises ON exercises.exercise_id = user_workout_exercises.exercise_id
      WHERE user_workouts.plan_id = ?
        AND user_workouts.is_deleted = FALSE
        AND (user_workout_exercises.is_deleted = FALSE OR user_workout_exercises.is_deleted IS NULL)
      ORDER BY user_workouts.id, user_workout_exercises.exercise_order ASC
      `,
      [planId],
    )) as RawWorkoutRecord[];

    return rawWorkouts;
  } catch (error: any) {
    console.error("Error fetching workouts for plan", error);
    Bugsnag.notify(error);
    throw new Error("Failed to fetch workouts for plan");
  }
};

const parseWorkouts = (rawWorkouts: RawWorkoutRecord[]) => {
  const workoutsMap = new Map<number, WorkoutRecord>();

  for (const rawWorkout of rawWorkouts) {
    let workout = workoutsMap.get(rawWorkout.id);
    if (!workout) {
      workout = {
        id: rawWorkout.id,
        plan_id: rawWorkout.plan_id,
        name: rawWorkout.name,
        exercises: [],
      };
      workoutsMap.set(rawWorkout.id, workout);
    }

    if (rawWorkout.exercise_id && rawWorkout.exercise_name) {
      workout.exercises.push({
        exercise_id: rawWorkout.exercise_id,
        name: rawWorkout.exercise_name,
        description: rawWorkout.description || "",
        image: rawWorkout.image ? Array.from(rawWorkout.image) : [],
        local_animated_uri: rawWorkout.local_animated_uri || "",
        animated_url: rawWorkout.animated_url || "",
        equipment: rawWorkout.equipment || "",
        body_part: rawWorkout.body_part || "",
        target_muscle: rawWorkout.target_muscle || "",
        secondary_muscles: rawWorkout.secondary_muscles
          ? JSON.parse(rawWorkout.secondary_muscles)
          : [],
        tracking_type: rawWorkout.tracking_type || "",
        sets: rawWorkout.sets ? JSON.parse(rawWorkout.sets) : [],
      });
    }
  }

  // Convert Map to array and ensure exercises are ordered
  return Array.from(workoutsMap.values());
};

const fetchPlan = async (planId: number): Promise<Plan | null> => {
  try {
    const [planData, rawWorkouts] = await Promise.all([
      fetchPlanData(planId),
      fetchWorkoutsForPlan(planId),
    ]);

    if (!planData) {
      return null;
    }

    const parsedWorkouts = parseWorkouts(rawWorkouts);
    return {
      ...planData,
      workouts: parsedWorkouts,
    };
  } catch (error: any) {
    console.error("Error fetching plan", error);
    Bugsnag.notify(error);
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
