import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import Bugsnag from "@bugsnag/expo";
import {
  publishStandaloneWorkout,
  unpublishStandaloneWorkout,
} from "@/utils/sharing";

export const useWorkoutPublishMutation = (workoutId: number) => {
  const user = useContext(AuthContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publish: boolean) => {
      if (!user) throw new Error("Not authenticated");
      if (publish) {
        await publishStandaloneWorkout(user.uid, workoutId);
      } else {
        await unpublishStandaloneWorkout(user.uid, workoutId);
      }
      return publish;
    },
    onSuccess: (published) => {
      queryClient.setQueryData(["workoutPublished", user?.uid, workoutId], published);
      queryClient.invalidateQueries({ queryKey: ["publishedWorkoutIds"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
