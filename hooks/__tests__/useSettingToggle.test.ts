import { renderHook, act } from "@testing-library/react-native";
import { useSettingToggle } from "../useSettingToggle";

const mockMutate = jest.fn();
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { translateExerciseNames: "true" } }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: mockMutate }),
}));

describe("useSettingToggle", () => {
  beforeEach(() => mockMutate.mockReset());

  it("flips at once and writes the stored value", () => {
    const { result } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(mockMutate).toHaveBeenCalledWith(
      { key: "translateExerciseNames", value: "false" },
      expect.anything(),
    );
  });

  it("flips back and calls onError when the write fails", () => {
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useSettingToggle("translateExerciseNames"),
    );
    act(() => result.current[1](false, onError));
    const { onError: failWrite } = mockMutate.mock.calls[0][1];
    act(() => failWrite());
    expect(result.current[0]).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
