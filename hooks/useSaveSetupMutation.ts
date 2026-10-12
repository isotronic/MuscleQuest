import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveBodyWeightMeasurement,
  saveWeekStart,
  updateSettings,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { SETUP_DONE_KEY, SetupState } from "@/utils/setupState";
import type { SetupWrite } from "@/utils/setupChanges";

/**
 * Applies the setup screen's changes (see setupChanges) and marks setup done,
 * through the same writes the settings screen uses.
 */
export const useSaveSetupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (write: SetupWrite) => {
      for (const { key, value } of write.settings) {
        await updateSettings(key, value);
      }
      if (write.weekStartsOn !== undefined) {
        await saveWeekStart(write.weekStartsOn, new Date(), {
          immediately: write.weekStartImmediately,
        });
      }
      if (write.bodyWeightKg !== undefined) {
        await saveBodyWeightMeasurement(write.bodyWeightKg);
        await updateSettings("bodyWeight", String(write.bodyWeightKg));
      }
      await updateSettings(SETUP_DONE_KEY, SetupState.done);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      // Units and body weight change how history and measurements display.
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["bodyMeasurements"] });
    },
    onError: (error) => {
      console.error("Failed to save setup:", error);
      notifyBugsnag(error);
    },
  });
};
