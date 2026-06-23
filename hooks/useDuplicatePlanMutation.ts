import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";
import { duplicatePlan } from "@/utils/database";

export const useDuplicatePlanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      planName,
      imageUrl,
    }: {
      planId: number;
      planName: string;
      imageUrl: string | null;
    }) => duplicatePlan(planId, planName, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["allPlans"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
