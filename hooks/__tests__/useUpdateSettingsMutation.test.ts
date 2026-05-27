import { useUpdateSettingsMutation } from "../useUpdateSettingsMutation";
import { updateSettings } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  updateSettings: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

describe("useUpdateSettingsMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
  });

  beforeEach(() => {
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls updateSettings with key and value", async () => {
    (updateSettings as jest.Mock).mockResolvedValue(undefined);
    useUpdateSettingsMutation();

    await capturedArgs.mutationFn({ key: "weeklyGoal", value: "5" });

    expect(updateSettings).toHaveBeenCalledWith("weeklyGoal", "5");
  });

  it("onSuccess invalidates ['settings'] query", () => {
    useUpdateSettingsMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settings"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useUpdateSettingsMutation();

    const error = new Error("update failed");
    capturedArgs.onError(error);

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
