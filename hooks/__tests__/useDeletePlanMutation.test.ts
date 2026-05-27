import { useDeletePlanMutation } from "../useDeletePlanMutation";
import { deleteWorkoutPlan } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  deleteWorkoutPlan: jest.fn(),
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

describe("useDeletePlanMutation", () => {
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
    // Re-run to populate capturedArgs after clearAllMocks
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls deleteWorkoutPlan with planId", async () => {
    (deleteWorkoutPlan as jest.Mock).mockResolvedValue(undefined);
    useDeletePlanMutation();

    await capturedArgs.mutationFn(42);

    expect(deleteWorkoutPlan).toHaveBeenCalledWith(42);
  });

  it("onSuccess invalidates ['plans'] and ['activePlan']", () => {
    useDeletePlanMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["plans"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activePlan"],
    });
  });

  it("onError notifies Bugsnag", () => {
    const Bugsnag = require("@bugsnag/expo").default;
    useDeletePlanMutation();

    const error = new Error("delete failed");
    capturedArgs.onError(error);

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
