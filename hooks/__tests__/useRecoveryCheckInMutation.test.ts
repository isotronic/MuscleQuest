import { useRecoveryCheckInMutation } from "../useRecoveryCheckInMutation";
import { updateProgressionStateRecovery } from "@/utils/database";
import { recomputeProgression } from "@/utils/progressionRecompute";
import { useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  updateProgressionStateRecovery: jest.fn(),
}));
jest.mock("@/utils/progressionRecompute", () => ({
  recomputeProgression: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

describe("useRecoveryCheckInMutation", () => {
  let capturedArgs: any;
  const payloads = [
    { userWorkoutExerciseId: 1, recoveryRating: "fresh" },
    { userWorkoutExerciseId: 2, recoveryRating: "sore" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    useRecoveryCheckInMutation();
  });

  it("saves each rating before recomputing its suggestion", async () => {
    const calls: string[] = [];
    (updateProgressionStateRecovery as jest.Mock).mockImplementation(
      async (id: number, rating: string) => {
        calls.push(`save ${id} ${rating}`);
      },
    );
    (recomputeProgression as jest.Mock).mockImplementation(
      async (id: number, { recoveryRating }: { recoveryRating: string }) => {
        calls.push(`recompute ${id} ${recoveryRating}`);
      },
    );

    await capturedArgs.mutationFn(payloads);

    expect(calls).toEqual([
      "save 1 fresh",
      "recompute 1 fresh",
      "save 2 sore",
      "recompute 2 sore",
    ]);
  });

  it("refreshes each progression state and the pending list", () => {
    capturedArgs.onSuccess(undefined, payloads);

    expect(mockInvalidateQueries.mock.calls.map(([arg]) => arg)).toEqual([
      { queryKey: ["progressionState", 1] },
      { queryKey: ["progressionState", 2] },
      { queryKey: ["pendingRecovery"] },
    ]);
  });
});
