import type { ExerciseContext } from "@/hooks/useExerciseFeedbackMutation";
import type {
  EffortRating,
  ExerciseFeedbackPayload,
  PainFlag,
} from "@/types/progression";

/** One exercise waiting for post-exercise feedback. */
export interface FeedbackPrompt {
  userWorkoutExerciseId: number;
  exerciseName: string;
  performanceRatio: number;
  exerciseContext: ExerciseContext;
}

/** What the user picked on the feedback card. */
export interface FeedbackChoice {
  effort: EffortRating;
  pain: PainFlag;
  /**
   * Only sent with About right: the engine always progresses after Easy and
   * always holds after Hard. The default is to progress.
   */
  intent?: "progress" | "hold";
  notes?: string;
}

/**
 * Short of the rep target: the engine holds before it reads effort, so the
 * card asks only about pain.
 */
export function isBelowTarget(performanceRatio: number): boolean {
  return performanceRatio < 1.0;
}

export function buildFeedbackPayload(
  prompt: FeedbackPrompt,
  choice: FeedbackChoice,
): ExerciseFeedbackPayload {
  return {
    userWorkoutExerciseId: prompt.userWorkoutExerciseId,
    effortRating: choice.effort,
    painFlag: choice.pain,
    progressionIntent: choice.effort === "moderate" ? choice.intent : undefined,
    performanceRatio: prompt.performanceRatio,
    notes:
      choice.pain === "pain" ? choice.notes?.trim() || undefined : undefined,
  };
}

/**
 * Adds prompts to a list, one per exercise: a newer prompt for the same
 * exercise replaces the older one in place.
 */
export function mergePrompts(
  list: FeedbackPrompt[],
  added: FeedbackPrompt[],
): FeedbackPrompt[] {
  const result = [...list];
  for (const prompt of added) {
    const idx = result.findIndex(
      (p) => p.userWorkoutExerciseId === prompt.userWorkoutExerciseId,
    );
    if (idx === -1) result.push(prompt);
    else result[idx] = prompt;
  }
  return result;
}

export function withoutExercise(
  list: FeedbackPrompt[],
  userWorkoutExerciseId: number,
): FeedbackPrompt[] {
  return list.filter((p) => p.userWorkoutExerciseId !== userWorkoutExerciseId);
}

/**
 * Only blocks that were saved with this workout: by plan row, so a skipped
 * block of an exercise logged twice gets no prompt; by exercise for anything
 * saved without a row.
 */
export function savedCatchUpPrompts(
  prompts: FeedbackPrompt[],
  savedExercises: {
    user_workout_exercise_id?: number | null;
    exercise_id: number;
  }[],
): FeedbackPrompt[] {
  const savedRows = new Set<number>();
  const savedWithoutRow = new Set<number>();
  for (const e of savedExercises) {
    if (e.user_workout_exercise_id != null) {
      savedRows.add(e.user_workout_exercise_id);
    } else {
      savedWithoutRow.add(e.exercise_id);
    }
  }
  return prompts.filter((p) =>
    p.userWorkoutExerciseId != null && savedRows.has(p.userWorkoutExerciseId)
      ? true
      : savedWithoutRow.has(p.exerciseContext.exerciseId),
  );
}
