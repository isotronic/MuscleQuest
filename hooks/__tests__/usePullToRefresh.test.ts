import { renderHook, act } from "@testing-library/react-native";
import { usePullToRefresh } from "../usePullToRefresh";

describe("usePullToRefresh", () => {
  it("shows the spinner until the refresh settles", async () => {
    let finish: () => void = () => {};
    const refresh = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const { result } = renderHook(() => usePullToRefresh(refresh));

    let pending: Promise<void>;
    act(() => {
      pending = result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.refreshing).toBe(false);
  });

  it("clears the spinner when the refresh fails", async () => {
    const refresh = jest.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => usePullToRefresh(refresh));

    await act(async () => {
      await result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(false);
  });
});
