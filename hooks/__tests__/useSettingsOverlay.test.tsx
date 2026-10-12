import { act, renderHook } from "@testing-library/react-native";
import Bugsnag from "@bugsnag/expo";
import { useSettingsOverlay } from "../useSettingsOverlay";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { showSnackbar } from "@/store/snackbarStore";

const mockSaveWeekStart = jest.fn();

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("@/components/SettingsModal", () => ({ SettingsModal: () => null }));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: () => ({ data: { weekStartsOn: "1" } }),
}));
jest.mock("@/hooks/useUpdateSettingsMutation", () => ({
  useUpdateSettingsMutation: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/hooks/useSaveWeekStartMutation", () => ({
  useSaveWeekStartMutation: () => ({ mutateAsync: mockSaveWeekStart }),
}));
jest.mock("@/hooks/useWeekRule", () => ({
  useWeekRule: () => ({ weekStartsOn: 1 }),
}));
jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));

describe("useSettingsOverlay", () => {
  it("reports a failed save once and tells the user", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("disk full");
    mockSaveWeekStart.mockRejectedValue(error);
    const { result } = renderHook(() => useSettingsOverlay());

    act(() => result.current.showOverlay("weekStartsOn", "1", "radio"));
    act(() => result.current.overlay.props.onChangeValue("0"));
    await act(async () => {
      await result.current.overlay.props.onSave();
    });

    expect(mockSaveWeekStart).toHaveBeenCalledWith(0);
    expect(Bugsnag.notify).not.toHaveBeenCalled();
    expect(notifyBugsnag).toHaveBeenCalledWith(error);
    expect(showSnackbar).toHaveBeenCalledWith(
      "Couldn't save the setting. Try again.",
    );
    expect(result.current.overlay.props.visible).toBe(false);
  });
});
