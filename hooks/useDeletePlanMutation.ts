import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import {
  deleteWorkoutPlan,
  restoreWorkoutPlan,
  type DeletedPlanSnapshot,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { showSnackbar } from "@/store/snackbarStore";

const UNDO_WINDOW_MS = 5000;

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["activePlan"] });
  };

  const undoDelete = async (snapshot: DeletedPlanSnapshot) => {
    try {
      await restoreWorkoutPlan(snapshot);
      invalidatePlans();
    } catch (error) {
      notifyBugsnag(error);
      showSnackbar(t`Couldn't restore the plan.`);
    }
  };

  return useMutation<DeletedPlanSnapshot, Error, number>({
    mutationFn: (planId: number) => deleteWorkoutPlan(planId),
    onSuccess: (snapshot) => {
      invalidatePlans();
      showSnackbar(t`Plan deleted`, {
        duration: UNDO_WINDOW_MS,
        action: { label: t`Undo`, onPress: () => void undoDelete(snapshot) },
      });
    },
    onError: (error: Error) => {
      notifyBugsnag(error);
      console.error("Failed to delete plan:", error);
    },
  });
}
