import { useQuery } from "@tanstack/react-query";
import { fetchLastCompletedPlanWorkout } from "@/utils/database";

// Under "completedWorkouts" so saving, editing or deleting a session refreshes
// the rotation.
export const useLastPlanWorkoutQuery = (planId: number | null) =>
  useQuery({
    queryKey: ["completedWorkouts", "lastPlanWorkout", planId],
    queryFn: () => fetchLastCompletedPlanWorkout(planId!),
    enabled: planId !== null,
  });
