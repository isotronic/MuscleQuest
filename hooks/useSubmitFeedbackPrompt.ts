import { useCallback } from "react";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useExerciseFeedbackMutation } from "@/hooks/useExerciseFeedbackMutation";
import type { ExerciseFeedbackPayload } from "@/types/progression";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

/**
 * Stores the answer to a feedback card. The live card and the summary's
 * catch-up rows both go through here, so they write the same thing.
 *
 * Resolves to whether the write succeeded (a failure is reported by the
 * global mutation handler). A promise rather than mutate's callbacks: those
 * fire only for the latest call and not at all once the caller unmounts.
 */
export function useSubmitFeedbackPrompt() {
  const { mutateAsync } = useExerciseFeedbackMutation();
  return useCallback(
    (
      prompt: FeedbackPrompt,
      feedback: ExerciseFeedbackPayload,
    ): Promise<boolean> => {
      // Up front, not on success: the session screen may unmount before the
      // write lands, and a card still queued would come back on the summary.
      useActiveWorkoutStore
        .getState()
        .recordFeedbackSubmitted(prompt.userWorkoutExerciseId);
      return mutateAsync({
        feedback,
        exerciseContext: prompt.exerciseContext,
      }).then(
        () => true,
        () => false,
      );
    },
    [mutateAsync],
  );
}
