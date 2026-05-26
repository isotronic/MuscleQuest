import { useExerciseInfoQuery } from "../useExerciseInfoQuery";
import { fetchRecord } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchRecord: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

describe("useExerciseInfoQuery", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { data: undefined, isLoading: false };
    });
  });

  it("uses queryKey ['exercise-info', exerciseId]", () => {
    useExerciseInfoQuery(42);
    expect(capturedArgs.queryKey).toEqual(["exercise-info", 42]);
  });

  it("queryFn calls fetchRecord for exercises table", async () => {
    (fetchRecord as jest.Mock).mockResolvedValue({
      exercise_id: 42,
      name: "Squat",
    });
    useExerciseInfoQuery(42);
    const result = await capturedArgs.queryFn();
    expect(fetchRecord).toHaveBeenCalledWith("userData.db", "exercises", 42);
    expect(result).toEqual({ exercise_id: 42, name: "Squat" });
  });

  it("sets staleTime to 5 minutes", () => {
    useExerciseInfoQuery(1);
    expect(capturedArgs.staleTime).toBe(5 * 60 * 1000);
  });
});
