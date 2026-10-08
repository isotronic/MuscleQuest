import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSettings } from "@/utils/database";
import type { Settings } from "@/utils/db/settings";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useSettingsQuery } from "./useSettingsQuery";
import { normalizeStatsLayout, type StatsLayout } from "@/utils/statsLayout";

export const STATS_LAYOUT_KEY = "statsLayout";

/** The stats screen layout, with defaults for anything not stored. */
export const useStatsLayout = () => {
  const { data: settings, isLoading } = useSettingsQuery();
  const raw = settings?.statsLayout;
  const layout = useMemo(() => normalizeStatsLayout(raw), [raw]);
  return { layout, isLoading };
};

/**
 * Saves a whole layout. The settings cache is updated first so toggles and
 * drags feel instant; a failed write rolls it back.
 */
export const useUpdateStatsLayoutMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (layout: StatsLayout) =>
      updateSettings(STATS_LAYOUT_KEY, JSON.stringify(layout)),
    onMutate: async (layout) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<Settings>(["settings"]);
      if (previous) {
        queryClient.setQueryData<Settings>(["settings"], {
          ...previous,
          statsLayout: JSON.stringify(layout),
        });
      }
      return { previous };
    },
    onError: (error, _layout, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["settings"], context.previous);
      }
      notifyBugsnag(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
  const { mutate } = mutation;
  const save = useCallback((layout: StatsLayout) => mutate(layout), [mutate]);
  return { ...mutation, save };
};
