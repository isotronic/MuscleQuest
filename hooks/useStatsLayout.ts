import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSettings } from "@/utils/database";
import type { Settings } from "@/utils/db/settings";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useSettingsQuery } from "./useSettingsQuery";
import { normalizeStatsLayout, type StatsLayout } from "@/utils/statsLayout";

export const STATS_LAYOUT_KEY = "statsLayout";
const SAVE_MUTATION_KEY = ["statsLayout", "save"];

/** The stats screen layout, with defaults for anything not stored. */
export const useStatsLayout = () => {
  const { data: settings, isLoading } = useSettingsQuery();
  const raw = settings?.statsLayout;
  const layout = useMemo(() => normalizeStatsLayout(raw), [raw]);
  return { layout, isLoading };
};

/**
 * Saves a whole layout. The settings cache is updated first so toggles and
 * drags feel instant; a failed write rolls it back. Saves run one at a time
 * in the order made, so quick toggles cannot land out of order, and the
 * settings refetch waits for the last of them.
 */
export const useUpdateStatsLayoutMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: SAVE_MUTATION_KEY,
    scope: { id: STATS_LAYOUT_KEY },
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
      // A queued save has already put its newer layout in the cache, and
      // its snapshot was taken after ours. Restoring ours would wipe it, so
      // only the last pending save rolls back; the refetch after it fixes the
      // cache either way.
      const isLast =
        queryClient.isMutating({ mutationKey: SAVE_MUTATION_KEY }) === 1;
      if (isLast && context?.previous) {
        queryClient.setQueryData(["settings"], context.previous);
      }
      notifyBugsnag(error);
    },
    onSettled: () => {
      // An earlier save refetching now would overwrite the newer layout
      // still in the cache. This save still counts, so 1 means it is last.
      if (queryClient.isMutating({ mutationKey: SAVE_MUTATION_KEY }) === 1) {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    },
  });
  const { mutate } = mutation;
  const save = useCallback((layout: StatsLayout) => mutate(layout), [mutate]);
  return { ...mutation, save };
};
