import { useNetInfo } from "@react-native-community/netinfo";
import { isOnlineState } from "@/utils/networkStatus";

/** True unless NetInfo positively reports no connection or no internet. */
export function useIsOnline(): boolean {
  return isOnlineState(useNetInfo());
}
