import { AccessibilityInfo } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { useReduceMotion } from "../useReduceMotion";

const mockLaunchValue = jest.fn(() => false);
jest.mock("react-native-reanimated", () => ({
  useReducedMotion: () => mockLaunchValue(),
}));

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

  it("starts from the value read at launch, before the query settles", () => {
    mockLaunchValue.mockReturnValueOnce(true);
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(true);
  });

  it("keeps a change event over a slower initial query", async () => {
    let resolveQuery: (v: boolean) => void = () => {};
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValue(new Promise((r) => (resolveQuery = r)));
    const { result } = renderHook(() => useReduceMotion());
    act(() => listener?.(true));
    await act(async () => resolveQuery(false));
    expect(result.current).toBe(true);
  });
});
