import { useDeletePlanMutation } from "../useDeletePlanMutation";
import { deleteWorkoutPlan, restoreWorkoutPlan } from "@/utils/database";
import { useSnackbarStore } from "@/store/snackbarStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncPlanRemoved, syncPlanRestored } from "@/utils/sharedSync";

jest.mock("@/utils/database", () => ({
  deleteWorkoutPlan: jest.fn(),
  restoreWorkoutPlan: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/sharedSync", () => ({
  syncPlanRemoved: jest.fn(() => true),
  syncPlanRestored: jest.fn(),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
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
    jest.spyOn(console, "error").mockImplementation(() => {});
    const Bugsnag = require("@bugsnag/expo").default;
    useDeletePlanMutation();

    const error = new Error("delete failed");
    capturedArgs.onError(error);

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });

  it("offers Undo that brings back the plan with its workouts", async () => {
    const snapshot = {
      planId: 42,
      workoutIds: [1, 2],
      workoutExerciseIds: [10, 11, 12],
    };
    useDeletePlanMutation();
    capturedArgs.onSuccess(snapshot, 42);

    const current = useSnackbarStore.getState().current;
    expect(current?.message).toBe("Plan deleted");
    expect(current?.action?.label).toBe("Undo");

    mockInvalidateQueries.mockClear();
    useSnackbarStore.getState().pressAction();
    await new Promise((r) => setImmediate(r));

    expect(restoreWorkoutPlan).toHaveBeenCalledWith(snapshot);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["plans"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activePlan"],
    });
  });

  it("unpublishes on delete and republishes on Undo", async () => {
    const snapshot = { planId: 42, workoutIds: [], workoutExerciseIds: [] };
    useDeletePlanMutation();
    capturedArgs.onSuccess(snapshot, 42);

    expect(syncPlanRemoved).toHaveBeenCalledWith(42);

    useSnackbarStore.getState().pressAction();
    await new Promise((r) => setImmediate(r));

    expect(syncPlanRestored).toHaveBeenCalledWith(42, true);
  });
});
