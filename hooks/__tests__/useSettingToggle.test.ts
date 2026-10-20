import { renderHook, act } from "@testing-library/react-native";
import { useSettingToggle } from "../useSettingToggle";

const mockMutate = jest.fn();
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { translateExerciseNames: "true" } }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutateAsync: mockMutate }),
}));

describe("useSettingToggle", () => {
  beforeEach(() => mockMutate.mockReset().mockResolvedValue(undefined));

  it("flips at once and writes the stored value", () => {
    const { result } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(mockMutate).toHaveBeenCalledWith({
      key: "translateExerciseNames",
      value: "false",
    });
  });

  it("flips back and calls onError when the write fails", async () => {
    mockMutate.mockRejectedValue(new Error("write failed"));
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    await act(async () => result.current[1](false, onError));
    expect(result.current[0]).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("still calls onError when the write fails after unmount", async () => {
    let failWrite: (error: Error) => void = () => {};
    mockMutate.mockReturnValue(
      new Promise((_, reject) => {
        failWrite = reject;
      }),
    );
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    act(() => result.current[1](false, onError));
    unmount();
    await act(async () => failWrite(new Error("write failed")));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("ignores a tap while a write is still running", async () => {
    let finishWrite: () => void = () => {};
    mockMutate.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    act(() => {
      expect(result.current[1](false)).toBe(true);
    });
    act(() => {
      expect(result.current[1](true)).toBe(false);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe(false);

    await act(async () => finishWrite());
    act(() => result.current[1](true));
    expect(mockMutate).toHaveBeenCalledTimes(2);
  });
});
