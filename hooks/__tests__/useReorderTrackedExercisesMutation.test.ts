import { useReorderTrackedExercisesMutation } from "../useReorderTrackedExercisesMutation";
import { reorderTrackedExercises } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  reorderTrackedExercises: jest.fn(),
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

describe("useReorderTrackedExercisesMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (reorderTrackedExercises as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls reorderTrackedExercises with exerciseIds", async () => {
    useReorderTrackedExercisesMutation();

    await capturedArgs.mutationFn([3, 1, 2]);

    expect(reorderTrackedExercises).toHaveBeenCalledWith([3, 1, 2]);
  });

  it("onSuccess invalidates trackedExercises query", async () => {
    useReorderTrackedExercisesMutation();

    await capturedArgs.onSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["trackedExercises"],
    });
  });

  it("onError reports to Bugsnag", () => {
    useReorderTrackedExercisesMutation();

    const error = new Error("db error");
    capturedArgs.onError(error);

    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});
