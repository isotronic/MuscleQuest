import { usePinExerciseMutation } from "../usePinExerciseMutation";
import { pinExercise, unpinExercise } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSnackbar } from "@/store/snackbarStore";

jest.mock("@/utils/database", () => ({
  pinExercise: jest.fn(),
  unpinExercise: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));

const mockInvalidateQueries = jest.fn();

describe("usePinExerciseMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("pins when pinned is true and unpins when false", async () => {
    usePinExerciseMutation();

    await capturedArgs.mutationFn({ exerciseId: 4, pinned: true });
    expect(pinExercise).toHaveBeenCalledWith(4);

    await capturedArgs.mutationFn({ exerciseId: 4, pinned: false });
    expect(unpinExercise).toHaveBeenCalledWith(4);
  });

  it("onSuccess refreshes the pinned list and recent PRs", () => {
    usePinExerciseMutation();

    capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["trackedExercises"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkouts", "recentPRs"],
    });
  });

  it("onError tells the user", () => {
    usePinExerciseMutation();

    capturedArgs.onError(new Error("nope"));

    expect(showSnackbar).toHaveBeenCalled();
  });
});
