/**
 * Whether adaptive progression can run for the active session: plan workouts
 * and saved workouts outside plans, not quick workouts. Progression state is
 * keyed by `user_workout_exercises` ids, which only a saved workout has.
 */
export function sessionSupportsProgression(session: {
  workoutId: number | null | undefined;
  isQuickWorkout: boolean;
}): boolean {
  return session.workoutId != null && !session.isQuickWorkout;
}
