import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveSetupChanges } from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import type { SetupWrite } from "@/utils/setupChanges";

/** Applies the setup screen's changes and marks setup done, all or nothing. */
export const useSaveSetupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (write: SetupWrite) => saveSetupChanges(write),
    onSuccess: async () => {
      // Units and body weight change how history and measurements display.
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["bodyMeasurements"] });
      // Awaited, so the save resolves with setupDone refetched: the (app)
      // layout would otherwise still see "pending" and send the user back.
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      console.error("Failed to save setup:", error);
      notifyBugsnag(error);
    },
  });
};
