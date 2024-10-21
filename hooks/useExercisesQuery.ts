import { useQuery } from "@tanstack/react-query";
import { fetchAllRecords, openDatabase } from "@/utils/database";
import { Exercise } from "@/utils/database";

const fetchAndSortExercises = async (
  sortByActivePlan?: boolean,
): Promise<Exercise[]> => {
  const exercises = (await fetchAllRecords(
    "userData.db",
    "exercises",
  )) as Exercise[];

  if (sortByActivePlan) {
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

    // Sort exercises: active plan exercises first, then others by id
    return exercises.sort((a, b) => {
      const aIsActive = activeExerciseIds.includes(a.exercise_id);
      const bIsActive = activeExerciseIds.includes(b.exercise_id);
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return a.exercise_id - b.exercise_id;
    });
  }

  return exercises;
};

export const useExercisesQuery = (sortByActivePlan?: boolean) => {
  return useQuery<Exercise[]>({
    queryKey: ["exercises", sortByActivePlan ? "sortByActivePlan" : "default"],
    queryFn: () => fetchAndSortExercises(sortByActivePlan),
    staleTime: 5 * 60 * 1000,
  });
};
