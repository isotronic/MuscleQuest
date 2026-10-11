import { useQuery } from "@tanstack/react-query";
import { countSavedWorkoutSessions } from "@/utils/database";

// Under "completedWorkouts" so saving or deleting a workout refreshes it.
export const useSavedWorkoutSessionCountQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ["completedWorkouts", "savedSessionCount"],
    queryFn: countSavedWorkoutSessions,
    enabled,
  });
