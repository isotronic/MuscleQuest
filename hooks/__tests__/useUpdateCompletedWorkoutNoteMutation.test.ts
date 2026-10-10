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
const setQueriesData = jest.fn();
const cancelQueries = jest.fn();

describe("useUpdateCompletedWorkoutNoteMutation", () => {
  let options: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries,
      setQueriesData,
      cancelQueries,
    });
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
    options.onSettled();
    const keys = invalidateQueries.mock.calls.map(([arg]) => arg.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ["completedWorkout", 7],
        ["workoutSessionHistory"],
        ["globalExerciseHistoryForSession"],
      ]),
    );
  });

  it("shows the new note straight away, trimmed, blank as null", async () => {
    useUpdateCompletedWorkoutNoteMutation(7);
    await options.onMutate("  Felt strong ");

    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: ["completedWorkout", 7],
    });
    const [filter, update] = setQueriesData.mock.calls[0];
    expect(filter).toEqual({ queryKey: ["completedWorkout", 7] });
    expect(update({ id: 7, notes: null })).toEqual({
      id: 7,
      notes: "Felt strong",
    });
    expect(update(undefined)).toBeUndefined();

    setQueriesData.mockClear();
    await options.onMutate("   ");
    expect(setQueriesData.mock.calls[0][1]({ id: 7, notes: "x" })).toEqual({
      id: 7,
      notes: null,
    });
  });
});
