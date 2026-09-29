import { useCallback, useState } from "react";

/**
 * State for a RefreshControl: `refreshing` stays true until `refresh` settles.
 * A failed refresh just ends the spinner; query errors are reported by the
 * global QueryCache handler.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // Reported elsewhere; the list keeps showing what it had.
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, onRefresh };
}
