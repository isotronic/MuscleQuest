import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

/**
 * Almost every query and mutation reads or writes on-device SQLite, so none of
 * them should pause when the phone is offline. `networkMode: "always"` keeps
 * React Query's online state (fed from NetInfo) to reconnect refetching only.
 */
export function createAppQueryClient(reportError: (error: unknown) => void) {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error) => reportError(error) }),
    // MutationCache.onError runs before each hook's own onError, so the hook's
    // notifyBugsnag would not have marked the error yet. onSettled runs after the
    // hook's onError has finished, so the dedup check sees it.
    mutationCache: new MutationCache({
      onSettled: (_data, error) => {
        if (error) reportError(error);
      },
    }),
    defaultOptions: {
      queries: { networkMode: "always" },
      mutations: { networkMode: "always" },
    },
  });
}
