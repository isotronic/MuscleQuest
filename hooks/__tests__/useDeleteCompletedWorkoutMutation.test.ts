import { useDeleteCompletedWorkoutMutation } from "../useDeleteCompletedWorkoutMutation";
import {
  deleteCompletedWorkout,
  restoreCompletedWorkout,
} from "@/utils/database";
import { useSnackbarStore } from "@/store/snackbarStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import {
  syncCompletedWorkoutChanged,
  syncCompletedWorkoutRemoved,
} from "@/utils/sharedSync";

jest.mock("@/utils/database", () => ({
  deleteCompletedWorkout: jest.fn(),
  restoreCompletedWorkout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/sharedSync", () => ({
  syncCompletedWorkoutRemoved: jest.fn(),
  syncCompletedWorkoutChanged: jest.fn(),
}));
jest.mock("@/utils/progressionRecompute", () => ({
  refreshProgressionAfterHistoryChange: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));
jest.mock("@lingui/core/macro", () => ({
  t: (str: any) => (Array.isArray(str) ? str[0] : str),
}));
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));

const mockInvalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

describe("useDeleteCompletedWorkoutMutation", () => {
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

  it("mutationFn calls deleteCompletedWorkout with id", async () => {
    (deleteCompletedWorkout as jest.Mock).mockResolvedValue(undefined);
    useDeleteCompletedWorkoutMutation();

    await capturedArgs.mutationFn(7);

    expect(deleteCompletedWorkout).toHaveBeenCalledWith(7);
  });

  it("onSuccess invalidates ['completedWorkouts'] and ['trackedExercises']", () => {
    useDeleteCompletedWorkoutMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["trackedExercises"],
    });
  });

  it("onSuccess invalidates exerciseDetail so the exercise screen refetches", () => {
    useDeleteCompletedWorkoutMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exerciseDetail"],
    });
  });

  it("onSuccess navigates back", () => {
    const { router } = require("expo-router");
    useDeleteCompletedWorkoutMutation();

    capturedArgs.onSuccess();

    expect(router.back).toHaveBeenCalled();
  });

  it("onError notifies Bugsnag", () => {
    const Bugsnag = require("@bugsnag/expo").default;
    useDeleteCompletedWorkoutMutation();

    const error = new Error("delete failed");
    capturedArgs.onError(error);

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });

  it("offers Undo for five seconds after deleting", () => {
    useDeleteCompletedWorkoutMutation();

    capturedArgs.onSuccess(undefined, 7);

    const current = useSnackbarStore.getState().current;
    expect(current?.message).toBe("Workout deleted");
    expect(current?.action?.label).toBe("Undo");
    expect(current?.duration).toBe(5000);
  });

  it("onSuccess refreshes progression suggestions for the deleted workout", () => {
    useDeleteCompletedWorkoutMutation();

    capturedArgs.onSuccess(undefined, 7);

    expect(refreshProgressionAfterHistoryChange).toHaveBeenCalledWith(
      { invalidateQueries: mockInvalidateQueries },
      7,
    );
  });

  it("Undo refreshes progression suggestions again", async () => {
    useDeleteCompletedWorkoutMutation();
    capturedArgs.onSuccess(undefined, 7);
    (refreshProgressionAfterHistoryChange as jest.Mock).mockClear();

    useSnackbarStore.getState().pressAction();
    await new Promise((r) => setImmediate(r));

    expect(refreshProgressionAfterHistoryChange).toHaveBeenCalledWith(
      { invalidateQueries: mockInvalidateQueries },
      7,
    );
  });

  it("Undo restores the workout and refreshes history", async () => {
    useDeleteCompletedWorkoutMutation();
    capturedArgs.onSuccess(undefined, 7);
    mockInvalidateQueries.mockClear();

    useSnackbarStore.getState().pressAction();
    await new Promise((r) => setImmediate(r));

    expect(restoreCompletedWorkout).toHaveBeenCalledWith(7);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts"],
    });
  });

  it("onSuccess removes the shared copy", () => {
    useDeleteCompletedWorkoutMutation();
    capturedArgs.onSuccess(undefined, 7);
    expect(syncCompletedWorkoutRemoved).toHaveBeenCalledWith(7);
  });

  it("Undo shares the workout again", async () => {
    useDeleteCompletedWorkoutMutation();
    capturedArgs.onSuccess(undefined, 7);

    useSnackbarStore.getState().pressAction();
    await new Promise((r) => setImmediate(r));

    expect(syncCompletedWorkoutChanged).toHaveBeenCalledWith(7);
  });
});
