import { useQuery } from "@tanstack/react-query";
import { fetchAllRecords, openDatabase } from "@/utils/database";
import { Exercise } from "@/utils/database";

interface ExercisesResult {
  activePlanExercises?: Exercise[];
  otherExercises: Exercise[];
  favoriteExercises?: Exercise[]; // Optional, only if favorites are included
}

const fetchAndSortExercises = async (
  includeActivePlan?: boolean,
  includeFavorites?: boolean,
): Promise<ExercisesResult> => {
  const exercises = (await fetchAllRecords(
    "userData.db",
    "exercises",
  )) as Exercise[];

  const result: ExercisesResult = {
    activePlanExercises: [],
    favoriteExercises: [],
    otherExercises: [],
  };

  let remainingExercises = exercises;

  // Handle active plan exercises if includeActivePlan is true
  if (includeActivePlan) {
    const db = await openDatabase("userData.db");

    // Fetch exercise IDs linked to the active plan's workouts
    const activePlanExercises = (await db.getAllAsync(`
      SELECT uwe.exercise_id
      FROM user_workout_exercises uwe
      JOIN user_workouts uw ON uwe.workout_id = uw.id
      JOIN user_plans up ON uw.plan_id = up.id
      WHERE up.is_active = TRUE AND uwe.is_deleted = FALSE AND uw.is_deleted = FALSE
    `)) as { exercise_id: number }[];

    const activeExerciseIds = activePlanExercises.map(
      (record) => record.exercise_id,
    );

    // Filter active plan exercises
    result.activePlanExercises = exercises.filter((exercise) =>
      activeExerciseIds.includes(exercise.exercise_id),
    );

    // Remove active plan exercises from the remaining exercises
    remainingExercises = remainingExercises.filter(
      (exercise) => !activeExerciseIds.includes(exercise.exercise_id),
    );
  }

  // Handle favorite exercises if includeFavorites is true
  if (includeFavorites) {
    result.favoriteExercises = remainingExercises.filter(
      (exercise) => exercise.favorite === 1,
    );

    // Remove favorite exercises from the remaining exercises
    remainingExercises = remainingExercises.filter(
      (exercise) => exercise.favorite !== 1,
    );
  }

  // Assign the remaining exercises to otherExercises
  result.otherExercises = remainingExercises;

  return result;
};

export const useExercisesQuery = (
  includeActivePlan?: boolean,
  includeFavorites?: boolean,
) => {
  return useQuery<ExercisesResult>({
    queryKey: [
      "exercises",
      includeActivePlan ? "includeActivePlan" : "",
      includeFavorites ? "includeFavorite" : "",
    ],
    queryFn: () => fetchAndSortExercises(includeActivePlan, includeFavorites),
    staleTime: 5 * 60 * 1000,
  });
};
