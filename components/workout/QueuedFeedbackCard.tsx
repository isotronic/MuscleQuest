import React from "react";
import ExerciseFeedbackCard from "@/components/ExerciseFeedbackCard";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSubmitFeedbackPrompt } from "@/hooks/useSubmitFeedbackPrompt";

/** The next waiting post-exercise feedback card, or nothing. */
export function QueuedFeedbackCard() {
  const submitFeedbackPrompt = useSubmitFeedbackPrompt();
  const prompt = useActiveWorkoutStore((s) => s.feedbackQueue[0]);
  const skipFeedbackPrompt = useActiveWorkoutStore((s) => s.skipFeedbackPrompt);
  if (!prompt) return null;
  return (
    <ExerciseFeedbackCard
      key={prompt.userWorkoutExerciseId}
      prompt={prompt}
      onSubmit={(payload) => void submitFeedbackPrompt(prompt, payload)}
      onSkip={skipFeedbackPrompt}
    />
  );
}

/** Whether a feedback card is waiting. */
export const useHasQueuedFeedback = () =>
  useActiveWorkoutStore((s) => s.feedbackQueue.length > 0);
