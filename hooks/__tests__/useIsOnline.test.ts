import { renderHook } from "@testing-library/react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useIsOnline } from "../useIsOnline";

jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: jest.fn(),
}));

const mockNetInfo = (
  isConnected: boolean | null,
  isInternetReachable: boolean | null,
) =>
  (useNetInfo as jest.Mock).mockReturnValue({
    isConnected,
    isInternetReachable,
  });

describe("useIsOnline", () => {
  it("is true before NetInfo has probed the connection", () => {
    mockNetInfo(null, null);
    expect(renderHook(() => useIsOnline()).result.current).toBe(true);
  });

  it("is false in airplane mode", () => {
    mockNetInfo(false, false);
    expect(renderHook(() => useIsOnline()).result.current).toBe(false);
  });

  it("is false on wifi with no internet", () => {
    mockNetInfo(true, false);
    expect(renderHook(() => useIsOnline()).result.current).toBe(false);
  });
});
