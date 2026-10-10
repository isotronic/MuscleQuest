import { useUpdateCompletedWorkoutNoteMutation } from "../useUpdateCompletedWorkoutNoteMutation";
import { updateCompletedWorkoutNotes } from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  updateCompletedWorkoutNotes: jest.fn(),
}));
jest.mock("@/store/snackbarStore", () => ({ showSnackbar: jest.fn() }));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const invalidateQueries = jest.fn();

describe("useUpdateCompletedWorkoutNoteMutation", () => {
  let options: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
    (useMutation as jest.Mock).mockImplementation((o) => {
      options = o;
      return {};
    });
  });

  it("writes the note to the completed workout", async () => {
    useUpdateCompletedWorkoutNoteMutation(7);
    await options.mutationFn("Felt strong");
    expect(updateCompletedWorkoutNotes).toHaveBeenCalledWith(7, "Felt strong");
  });

  it("refreshes the reads that show the note", () => {
    useUpdateCompletedWorkoutNoteMutation(7);
    options.onSuccess();
    const keys = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["completedWorkout", 7],
        ["workoutSessionHistory"],
        ["globalExerciseHistoryForSession"],
      ]),
    );
  });
});
