import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import { updateCompletedWorkoutNotes } from "@/utils/database";
import { showSnackbar } from "@/store/snackbarStore";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";

/** Edits the session note of a saved workout. The note is never shared. */
export const useUpdateCompletedWorkoutNoteMutation = (
  completedWorkoutId: number,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      updateCompletedWorkoutNotes(completedWorkoutId, notes),
    // Show the edit at once; the refetch below then confirms (or, after a
    // failure, restores) what is stored.
    onMutate: async (notes: string) => {
      const queryKey = ["completedWorkout", completedWorkoutId];
      await queryClient.cancelQueries({ queryKey });
      const stored = notes.trim() || null;
      queryClient.setQueriesData<CompletedWorkout>({ queryKey }, (old) =>
        old ? { ...old, notes: stored } : old,
      );
    },
    onSettled: () => {
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
