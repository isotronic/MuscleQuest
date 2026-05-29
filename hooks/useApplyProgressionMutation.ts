import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  applyProgressionToExercise,
  dismissProgressionState,
} from "@/utils/database";

export const useApplyProgressionMutation = () => {
  const queryClient = useQueryClient();

  const invalidate = (userWorkoutExerciseId: number) => {
    queryClient.invalidateQueries({
      queryKey: ["progressionState", userWorkoutExerciseId],
    });
    queryClient.invalidateQueries({ queryKey: ["workoutProgressionStates"] });
    queryClient.invalidateQueries({ queryKey: ["activePlan"] });
  };

  const applyMutation = useMutation({
    mutationFn: ({
      userWorkoutExerciseId,
      suggestedRepsMin,
      suggestedRepsMax,
    }: {
      userWorkoutExerciseId: number;
      suggestedRepsMin?: number;
      suggestedRepsMax?: number;
    }) =>
      applyProgressionToExercise(
        userWorkoutExerciseId,
        suggestedRepsMin,
        suggestedRepsMax,
      ),
    onSuccess: (_data, { userWorkoutExerciseId }) => {
      invalidate(userWorkoutExerciseId);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({
      userWorkoutExerciseId,
    }: {
      userWorkoutExerciseId: number;
    }) => dismissProgressionState(userWorkoutExerciseId),
    onSuccess: (_data, { userWorkoutExerciseId }) => {
      invalidate(userWorkoutExerciseId);
    },
  });

  return { applyMutation, dismissMutation };
};
