import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import { updateCompletedWorkoutNotes } from "@/utils/database";
import { showSnackbar } from "@/store/snackbarStore";

/** Edits the session note of a saved workout. The note is never shared. */
export const useUpdateCompletedWorkoutNoteMutation = (
  completedWorkoutId: number,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      updateCompletedWorkoutNotes(completedWorkoutId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["completedWorkout", completedWorkoutId],
      });
      queryClient.invalidateQueries({ queryKey: ["workoutSessionHistory"] });
      queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession"],
      });
    },
    // The failure itself is reported by the global MutationCache handler.
    onError: () => {
      showSnackbar(t`Couldn't save your note. Please try again.`);
    },
  });
};
