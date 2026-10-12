import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveWeekStart } from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import type { WeekStartDay } from "@/utils/week";

/** Changes the week start from the next week on; see utils/week.ts. */
export const useSaveWeekStartMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weekStartsOn: WeekStartDay) => saveWeekStart(weekStartsOn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      console.error("Failed to save week start:", error);
      notifyBugsnag(error);
    },
  });
};
