import { Plan } from "@/hooks/useAllPlansQuery";
import { Workout } from "@/store/workoutStore";

export interface PlanWorkoutEntry {
  workout: Workout;
  /** Index of the workout within its plan, before search filtering. */
  index: number;
}

export interface PlanWorkoutSection {
  planId: number | null;
  planName: string;
  workouts: PlanWorkoutEntry[];
}

export interface WorkoutPickerSections {
  planSections: PlanWorkoutSection[];
  standaloneWorkouts: Workout[];
}

export function buildWorkoutPickerSections(
  userPlans: Plan[],
  standaloneWorkouts: Workout[],
  query: string,
): WorkoutPickerSections {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (name: string) =>
    normalizedQuery === "" || name.toLowerCase().includes(normalizedQuery);

  const planSections: PlanWorkoutSection[] = userPlans
    .map((plan) => ({
      planId: plan.id,
      planName: plan.name,
      workouts: plan.workouts
        .map((workout, index) => ({ workout, index }))
        .filter((entry) => matchesQuery(entry.workout.name)),
    }))
    .filter((section) => section.workouts.length > 0);

  const filteredStandalone = standaloneWorkouts.filter((workout) =>
    matchesQuery(workout.name),
  );

  return { planSections, standaloneWorkouts: filteredStandalone };
}
