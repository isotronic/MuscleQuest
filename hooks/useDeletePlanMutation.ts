import { useMutation, useQueryClient } from "@tanstack/react-query";
import { t } from "@lingui/core/macro";
import {
  deleteWorkoutPlan,
  restoreWorkoutPlan,
  type DeletedPlanSnapshot,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { showSnackbar } from "@/store/snackbarStore";
import { syncPlanRemoved, syncPlanRestored } from "@/utils/sharedSync";

const UNDO_WINDOW_MS = 5000;

export function useDeletePlanMutation() {
  const queryClient = useQueryClient();

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["activePlan"] });
  };

  const undoDelete = async (
    snapshot: DeletedPlanSnapshot,
    wasPublished: boolean,
  ) => {
    try {
      await restoreWorkoutPlan(snapshot);
      invalidatePlans();
      syncPlanRestored(snapshot.planId, wasPublished);
    } catch (error) {
      notifyBugsnag(error);
      showSnackbar(t`Couldn't restore the plan.`);
    }
  };

  return useMutation<DeletedPlanSnapshot, Error, number>({
    mutationFn: (planId: number) => deleteWorkoutPlan(planId),
    onSuccess: (snapshot, planId) => {
      invalidatePlans();
      const wasPublished = syncPlanRemoved(planId);
      showSnackbar(t`Plan deleted`, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: t`Undo`,
          onPress: () => void undoDelete(snapshot, wasPublished),
        },
      });
    },
    onError: (error: Error) => {
      notifyBugsnag(error);
      console.error("Failed to delete plan:", error);
    },
  });
}
