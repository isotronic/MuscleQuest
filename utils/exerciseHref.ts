/** Link to an exercise's screen, optionally on a given tab. */
export const exerciseHref = (
  exerciseId: number,
  tab?: "progress" | "history" | "about",
) => ({
  pathname: "/(app)/exercise-info" as const,
  params: tab
    ? { exercise_id: String(exerciseId), tab }
    : { exercise_id: String(exerciseId) },
});
