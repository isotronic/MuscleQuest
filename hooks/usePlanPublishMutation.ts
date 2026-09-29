import { useMutation } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { t } from "@lingui/core/macro";
import { showSnackbar } from "@/store/snackbarStore";
import { publishPlan, unpublishPlan } from "@/utils/sharing";

export const usePlanPublishMutation = (planId: number) => {
  const user = useContext(AuthContext);

  return useMutation({
    mutationFn: async (publish: boolean) => {
      if (!user) throw new Error("Not authenticated");
      if (publish) {
        await publishPlan(user.uid, planId);
      } else {
        await unpublishPlan(user.uid, planId);
      }
      return publish;
    },
    onSuccess: () => {},
    onError: (error: Error, publish: boolean) => {
      notifyBugsnag(error);
      showSnackbar(
        publish
          ? t`Couldn't share this plan. Try again when you're online.`
          : t`Couldn't stop sharing this plan. Try again when you're online.`,
      );
    },
  });
};
