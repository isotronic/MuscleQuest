import { useQuery } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

export interface ExerciseUsage {
  exerciseId: number;
  useCount: number;
  lastUsed: string;
}

const fetchExerciseUsage = async (): Promise<ExerciseUsage[]> => {
  const db = await openDatabase("userData.db");
  const rows = (await db.getAllAsync(`
    SELECT
      ce.exercise_id,
      COUNT(*) AS use_count,
      MAX(cw.date_completed) AS last_used
    FROM completed_exercises ce
    JOIN completed_workouts cw ON ce.completed_workout_id = cw.id
    WHERE cw.is_deleted = FALSE
    GROUP BY ce.exercise_id
  `)) as { exercise_id: number; use_count: number; last_used: string }[];

  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    useCount: r.use_count,
    lastUsed: r.last_used,
  }));
};

export const useExerciseUsageQuery = () => {
  return useQuery<ExerciseUsage[]>({
    queryKey: ["exerciseUsage"],
    queryFn: async () => {
      try {
        return await fetchExerciseUsage();
      } catch (error: any) {
        Bugsnag.notify(error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
};
