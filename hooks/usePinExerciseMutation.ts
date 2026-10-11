import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import { pinExercise, unpinExercise } from "@/utils/database";
import { showSnackbar } from "@/store/snackbarStore";

/** Pins an exercise to the Stats tab, or unpins it. */
export const usePinExerciseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { exerciseId: number; pinned: boolean }>({
    mutationFn: ({ exerciseId, pinned }) =>
      pinned ? pinExercise(exerciseId) : unpinExercise(exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      // The recent PRs widget can be limited to pinned exercises.
      queryClient.invalidateQueries({
        queryKey: ["completedWorkouts", "recentPRs"],
      });
    },
    onError: () => {
      showSnackbar(t`Couldn't update pinned exercises. Please try again.`);
    },
  });
};
