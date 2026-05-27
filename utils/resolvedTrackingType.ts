import { UserExercise } from "@/store/workoutStore";

export const resolvedTrackingType = (exercise: UserExercise): string =>
  exercise.tracking_type_override || exercise.tracking_type || "weight";
