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
  ProgressionEngineInputs,
  ProgressionAction,
} from "@/types/progression";
import { Set as PlanSet } from "@/store/workoutStore";

const STAGNATION_HOLD_RULES = new Set([
  "MODERATE_TARGET",
  "HARD_TARGET",
  "BELOW_TARGET",
  "NEAR_TARGET",
]);

const PROGRESSION_ACTIONS = new Set<ProgressionAction>([
  "increase_load",
  "increase_reps",
  "add_set",
]);

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
  if (f.painFlag === "pain") return "down";
  if (
    f.effortRating === "easy" &&
    f.performanceRatio >= 1.0 &&
    f.progressionIntent !== "hold"
  )
    return "up";
  if (f.effortRating === "failed") return "down";
  return "neutral";
}

/**
 * Determines the directional intent of the previous engine result.
 * "Hold" actions caused by a first failure or pain signal still count as
 * "down" so that a second consecutive event correctly increments the counter.
 */
function prevStateDirection(
  state: ExerciseProgressionState,
): "up" | "down" | "neutral" {
  if (
    state.suggestionAction === "hold" &&
    (state.ruleKey === "FAILED_FIRST_SIGNAL" || state.ruleKey === "PAIN_BLOCK")
  ) {
    return "down";
  }
  if (
    state.suggestionAction === "increase_load" ||
    state.suggestionAction === "increase_reps" ||
    state.suggestionAction === "add_set"
  )
    return "up";
  if (
    state.suggestionAction === "reduce_load" ||
    state.suggestionAction === "remove_set"
  )
    return "down";
  return "neutral";
}

function computeConsecutiveCount(
  feedback: ExerciseFeedbackPayload,
  existingState: ExerciseProgressionState | null,
): number {
  if (!existingState) return 1;
  const currentDir = feedbackDirection(feedback);
  const prevDir = prevStateDirection(existingState);
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

      const newDiscomfortStreakCount =
        feedback.painFlag === "discomfort"
          ? (existingState?.discomfortStreakCount ?? 0) + 1
          : 0;

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
        discomfortStreakCount: newDiscomfortStreakCount,
        userIncrements: progressionSettings.increments,
        completedRepsPerSet: exerciseContext.completedRepsPerSet,
      };

      const result = evaluateProgression(engineInputs);

      const isProgression = PROGRESSION_ACTIONS.has(result.action);
      const isStagnationHold = STAGNATION_HOLD_RULES.has(result.ruleKey);

      const newConsecutiveHoldCount = isProgression
        ? 0
        : isStagnationHold
          ? (existingState?.consecutiveHoldCount ?? 0) + 1
          : (existingState?.consecutiveHoldCount ?? 0);

      const plateauAdvisory = isStagnationHold && newConsecutiveHoldCount >= 4;

      const lastProgressionAt = isProgression
        ? new Date().toISOString()
        : (existingState?.lastProgressionAt ?? null);

      await upsertProgressionState(
        feedback.userWorkoutExerciseId,
        result,
        feedbackId,
        consecutiveCount,
        {
          discomfortStreakCount: newDiscomfortStreakCount,
          consecutiveHoldCount: newConsecutiveHoldCount,
          plateauAdvisory,
          lastProgressionAt,
        },
      );
    },
    onSuccess: (_data, { feedback }) => {
      queryClient.invalidateQueries({
        queryKey: ["progressionState", feedback.userWorkoutExerciseId],
      });
    },
  });
};
