import { AccessibilityInfo } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { useReduceMotion } from "../useReduceMotion";

describe("useReduceMotion", () => {
  let listener: ((enabled: boolean) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    listener = undefined;
    remove.mockClear();
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation((_event, handler) => {
        listener = handler as unknown as (enabled: boolean) => void;
        return { remove } as any;
      });
  });
  afterEach(() => jest.restoreAllMocks());

  it("reads the current setting", async () => {
    const { result } = renderHook(() => useReduceMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("follows changes made while the app is running", async () => {
    const { result } = renderHook(() => useReduceMotion());
    await act(async () => {});
    act(() => listener?.(false));
    expect(result.current).toBe(false);
  });

  it("stops listening on unmount", async () => {
    const { unmount } = renderHook(() => useReduceMotion());
    await act(async () => {});
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
