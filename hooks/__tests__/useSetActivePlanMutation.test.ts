import { useSetActivePlanMutation } from "../useSetActivePlanMutation";
import {
  updateActivePlan,
  fetchPlanSchedule,
  updateSettings,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  updateActivePlan: jest.fn(),
  fetchPlanSchedule: jest.fn(),
  updateSettings: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

describe("useSetActivePlanMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    (updateActivePlan as jest.Mock).mockResolvedValue(undefined);
    (fetchPlanSchedule as jest.Mock).mockResolvedValue([]);
    (updateSettings as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    (updateActivePlan as jest.Mock).mockResolvedValue(undefined);
    (fetchPlanSchedule as jest.Mock).mockResolvedValue([]);
    (updateSettings as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls updateActivePlan with planId", async () => {
    useSetActivePlanMutation();

    await capturedArgs.mutationFn(5);

    expect(updateActivePlan).toHaveBeenCalledWith(5);
  });

  it("onSuccess invalidates activePlan, plan, and plans queries", async () => {
    useSetActivePlanMutation();

    await capturedArgs.onSuccess(undefined, 5);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activePlan"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["plan"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["plans"],
    });
  });

  it("onSuccess syncs weeklyGoal when schedule has entries", async () => {
    (fetchPlanSchedule as jest.Mock).mockResolvedValue([
      { day_of_week: 0, workout_id: 1 },
      { day_of_week: 2, workout_id: 2 },
      { day_of_week: 4, workout_id: 3 },
    ]);

    useSetActivePlanMutation();

    await capturedArgs.onSuccess(undefined, 5);

    expect(updateSettings).toHaveBeenCalledWith("weeklyGoal", "3");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settings"],
    });
  });

  it("onSuccess does not update weeklyGoal when schedule is empty", async () => {
    (fetchPlanSchedule as jest.Mock).mockResolvedValue([]);

    useSetActivePlanMutation();

    await capturedArgs.onSuccess(undefined, 5);

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("onSuccess does not throw when fetchPlanSchedule fails", async () => {
    (fetchPlanSchedule as jest.Mock).mockRejectedValue(new Error("fetch fail"));

    useSetActivePlanMutation();

    // Should not throw - error is caught internally
    await expect(capturedArgs.onSuccess(undefined, 5)).resolves.not.toThrow();
  });
});
