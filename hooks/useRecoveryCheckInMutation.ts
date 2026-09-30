import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProgressionStateRecovery } from "@/utils/database";
import { recomputeProgression } from "@/utils/progressionRecompute";
import { RecoveryCheckInPayload } from "@/types/progression";

export const useRecoveryCheckInMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payloads: RecoveryCheckInPayload[]) => {
      for (const { userWorkoutExerciseId, recoveryRating } of payloads) {
        await updateProgressionStateRecovery(
          userWorkoutExerciseId,
          recoveryRating,
        );
        await recomputeProgression(userWorkoutExerciseId, { recoveryRating });
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
