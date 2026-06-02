import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  insertExerciseFeedback,
  getProgressionState,
  getProgressionSettings,
  upsertProgressionState,
} from "@/utils/database";
import { evaluateProgression } from "@/utils/progressionEngine";
import {
  ExerciseFeedbackPayload,
  ExerciseProgressionState,
  ProgressionAction,
  ProgressionEngineInputs,
} from "@/types/progression";
import { Set as PlanSet } from "@/store/workoutStore";

export interface ExerciseContext {
  exerciseId: number;
  trackingType: string;
  equipment: string;
  currentSets: PlanSet[];
  recentWorkingWeight: number | null;
  completedRepsPerSet?: (number | null)[];
}

interface SubmitFeedbackInput {
  feedback: ExerciseFeedbackPayload;
  exerciseContext: ExerciseContext;
}

function feedbackDirection(
  f: ExerciseFeedbackPayload,
): "up" | "down" | "neutral" {
  if (
    f.effortRating === "easy" &&
    f.performanceRatio >= 1.0 &&
    f.progressionIntent !== "hold"
  )
    return "up";
  if (f.effortRating === "failed") return "down";
  return "neutral";
}

function actionDirection(action: ProgressionAction): "up" | "down" | "neutral" {
  if (
    action === "increase_load" ||
    action === "increase_reps" ||
    action === "add_set"
  )
    return "up";
  if (action === "reduce_load" || action === "remove_set") return "down";
  return "neutral";
}

function computeConsecutiveCount(
  feedback: ExerciseFeedbackPayload,
  existingState: ExerciseProgressionState | null,
): number {
  if (!existingState) return 1;
  const currentDir = feedbackDirection(feedback);
  const prevDir = actionDirection(existingState.suggestionAction);
  if (currentDir !== "neutral" && currentDir === prevDir) {
    return existingState.consecutiveDirectionCount + 1;
  }
  return 1;
}

export const useExerciseFeedbackMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedback, exerciseContext }: SubmitFeedbackInput) => {
      const feedbackId = await insertExerciseFeedback(feedback);

      const [existingState, progressionSettings] = await Promise.all([
        getProgressionState(feedback.userWorkoutExerciseId),
        getProgressionSettings(),
      ]);

      const consecutiveCount = computeConsecutiveCount(feedback, existingState);

      const engineInputs: ProgressionEngineInputs = {
        userWorkoutExerciseId: feedback.userWorkoutExerciseId,
        exerciseId: exerciseContext.exerciseId,
        trackingType: exerciseContext.trackingType,
        equipment: exerciseContext.equipment,
        currentSets: exerciseContext.currentSets,
        recentWorkingWeight: exerciseContext.recentWorkingWeight,
        latestFeedback: feedback,
        priorFeedbackHistory: [],
        recoveryRating: existingState?.recoveryRating ?? null,
        consecutiveDirectionCount: consecutiveCount,
        userIncrements: progressionSettings.increments,
        completedRepsPerSet: exerciseContext.completedRepsPerSet,
      };

      const result = evaluateProgression(engineInputs);

      await upsertProgressionState(
        feedback.userWorkoutExerciseId,
        result,
        feedbackId,
        consecutiveCount,
      );
    },
    onSuccess: (_data, { feedback }) => {
      queryClient.invalidateQueries({
        queryKey: ["progressionState", feedback.userWorkoutExerciseId],
      });
    },
  });
};
