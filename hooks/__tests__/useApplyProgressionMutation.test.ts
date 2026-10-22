import { useApplyProgressionMutation } from "../useApplyProgressionMutation";
import {
  applyProgressionToExercise,
  dismissProgressionState,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  applyProgressionToExercise: jest.fn(),
  dismissProgressionState: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

describe("useApplyProgressionMutation", () => {
  let captured: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    captured = [];
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      captured.push(args);
      return { mutate: jest.fn() };
    });
    useApplyProgressionMutation();
  });

  it.each([
    ["apply", 0, applyProgressionToExercise],
    ["dismiss", 1, dismissProgressionState],
  ])("%s writes and refreshes the affected queries", async (_, index, fn) => {
    const { mutationFn, onSuccess } = captured[index];

    await mutationFn({ userWorkoutExerciseId: 7 });
    onSuccess(undefined, { userWorkoutExerciseId: 7 });

    expect(fn).toHaveBeenCalledWith(7);
    expect(mockInvalidateQueries.mock.calls.map(([arg]) => arg)).toEqual([
      { queryKey: ["progressionState", 7] },
      { queryKey: ["workoutProgressionStates"] },
      { queryKey: ["activePlan"] },
    ]);
  });
});
