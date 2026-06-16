import { useDuplicatePlanMutation } from "../useDuplicatePlanMutation";
import { duplicatePlan } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  duplicatePlan: jest.fn(),
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

describe("useDuplicatePlanMutation", () => {
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
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls duplicatePlan with planId, planName, and imageUrl", async () => {
    (duplicatePlan as jest.Mock).mockResolvedValue(99);
    useDuplicatePlanMutation();

    await capturedArgs.mutationFn({
      planId: 1,
      planName: "My Plan",
      imageUrl: "https://example.com/img.jpg",
    });

    expect(duplicatePlan).toHaveBeenCalledWith(
      1,
      "My Plan",
      "https://example.com/img.jpg",
    );
  });

  it("mutationFn returns the new plan ID", async () => {
    (duplicatePlan as jest.Mock).mockResolvedValue(99);
    useDuplicatePlanMutation();

    const result = await capturedArgs.mutationFn({
      planId: 1,
      planName: "My Plan",
      imageUrl: null,
    });

    expect(result).toBe(99);
  });

  it("onSuccess invalidates ['plans'] and ['allPlans']", () => {
    useDuplicatePlanMutation();
    capturedArgs.onSuccess(99);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["plans"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["allPlans"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useDuplicatePlanMutation();
    const error = new Error("duplicate failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
