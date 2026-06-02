import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateProgressionStateRecovery,
  getExerciseProgressionContext,
  getProgressionSettings,
  getProgressionState,
  upsertProgressionState,
} from "@/utils/database";
import { evaluateProgression } from "@/utils/progressionEngine";
import {
  ExerciseFeedbackPayload,
  ProgressionEngineInputs,
  ProgressionAction,
  RecoveryCheckInPayload,
  RecoveryRating,
} from "@/types/progression";

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

export const useRecoveryCheckInMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payloads: RecoveryCheckInPayload[]) => {
      const progressionSettings = await getProgressionSettings();

      for (const { userWorkoutExerciseId, recoveryRating } of payloads) {
        await updateProgressionStateRecovery(
          userWorkoutExerciseId,
          recoveryRating,
        );

        const [ctx, existingState] = await Promise.all([
          getExerciseProgressionContext(userWorkoutExerciseId),
          getProgressionState(userWorkoutExerciseId),
        ]);
        if (!ctx?.latestFeedback) continue;

        const latestFeedback: ExerciseFeedbackPayload = {
          userWorkoutExerciseId,
          effortRating: ctx.latestFeedback.effortRating,
          painFlag: ctx.latestFeedback.painFlag,
          progressionIntent: ctx.latestFeedback.progressionIntent,
          performanceRatio: ctx.latestFeedback.performanceRatio,
        };

        const engineInputs: ProgressionEngineInputs = {
          userWorkoutExerciseId,
          exerciseId: ctx.exerciseId,
          trackingType: ctx.trackingType,
          equipment: ctx.equipment,
          currentSets: ctx.currentSets,
          recentWorkingWeight: ctx.recentWorkingWeight,
          latestFeedback,
          priorFeedbackHistory: [],
          recoveryRating: recoveryRating as RecoveryRating,
          consecutiveDirectionCount: ctx.consecutiveDirectionCount,
          discomfortStreakCount: ctx.discomfortStreakCount,
          userIncrements: progressionSettings.increments,
        };

        const result = evaluateProgression(engineInputs);

        const isProgression = PROGRESSION_ACTIONS.has(result.action);
        const isStagnationHold = STAGNATION_HOLD_RULES.has(result.ruleKey);
        const newConsecutiveHoldCount = isProgression
          ? 0
          : isStagnationHold
            ? (existingState?.consecutiveHoldCount ?? 0) + 1
            : (existingState?.consecutiveHoldCount ?? 0);
        const plateauAdvisory = newConsecutiveHoldCount >= 4;
        const lastProgressionAt = isProgression
          ? new Date().toISOString()
          : (existingState?.lastProgressionAt ?? null);

        await upsertProgressionState(
          userWorkoutExerciseId,
          result,
          ctx.latestFeedback.id,
          ctx.consecutiveDirectionCount,
          {
            discomfortStreakCount: ctx.discomfortStreakCount,
            consecutiveHoldCount: newConsecutiveHoldCount,
            plateauAdvisory,
            lastProgressionAt,
          },
        );
      }
    },
    onSuccess: (_data, payloads) => {
      for (const { userWorkoutExerciseId } of payloads) {
        queryClient.invalidateQueries({
          queryKey: ["progressionState", userWorkoutExerciseId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["pendingRecovery"] });
    },
  });
};
