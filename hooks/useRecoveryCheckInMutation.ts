import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateProgressionStateRecovery,
  getExerciseProgressionContext,
  getProgressionSettings,
  upsertProgressionState,
} from "@/utils/database";
import { evaluateProgression } from "@/utils/progressionEngine";
import {
  ExerciseFeedbackPayload,
  ProgressionEngineInputs,
  RecoveryCheckInPayload,
  RecoveryRating,
} from "@/types/progression";

export const useRecoveryCheckInMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payloads: RecoveryCheckInPayload[]) => {
      const progressionSettings = await getProgressionSettings();

      await Promise.all(
        payloads.map(async ({ userWorkoutExerciseId, recoveryRating }) => {
          await updateProgressionStateRecovery(
            userWorkoutExerciseId,
            recoveryRating,
          );

          const ctx = await getExerciseProgressionContext(
            userWorkoutExerciseId,
          );
          if (!ctx?.latestFeedback) return;

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
            userIncrements: progressionSettings.increments,
          };

          const result = evaluateProgression(engineInputs);

          await upsertProgressionState(
            userWorkoutExerciseId,
            result,
            ctx.latestFeedback.id,
            ctx.consecutiveDirectionCount,
          );
        }),
      );
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
