import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

type ConnectionState = {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
};

/**
 * Only an explicit `false` counts as offline. NetInfo reports `null` until its
 * first probe finishes, and treating that as offline would flash offline UI on
 * every launch.
 */
export function isOnlineState(state: ConnectionState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Feed NetInfo into React Query so queries refetch on reconnect. The app's
 * QueryClient defaults to `networkMode: "always"` (see utils/queryClient.ts),
 * so going offline never pauses the SQLite queries the app runs on.
 */
export function connectOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
  );
}
