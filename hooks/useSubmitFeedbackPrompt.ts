import { useCallback } from "react";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useExerciseFeedbackMutation } from "@/hooks/useExerciseFeedbackMutation";
import type { ExerciseFeedbackPayload } from "@/types/progression";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

/**
 * Stores the answer to a feedback card. The live card and the summary's
 * catch-up rows both go through here, so they write the same thing.
 */
export function useSubmitFeedbackPrompt() {
  const { mutate } = useExerciseFeedbackMutation();
  return useCallback(
    (
      prompt: FeedbackPrompt,
      feedback: ExerciseFeedbackPayload,
      onSuccess?: () => void,
    ) => {
      useActiveWorkoutStore
        .getState()
        .recordFeedbackSubmitted(prompt.userWorkoutExerciseId);
      mutate(
        { feedback, exerciseContext: prompt.exerciseContext },
        { onSuccess },
      );
    },
    [mutate],
  );
}
