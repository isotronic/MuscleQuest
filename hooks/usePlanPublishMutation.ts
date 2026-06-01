import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import Bugsnag from "@bugsnag/expo";
import { publishPlan, unpublishPlan } from "@/utils/sharing";

export const usePlanPublishMutation = (planId: number) => {
  const user = useContext(AuthContext);
  const queryClient = useQueryClient();

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
    onSuccess: (published) => {
      queryClient.setQueryData(["planPublished", planId], published);
      queryClient.invalidateQueries({ queryKey: ["publishedPlanIds"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
