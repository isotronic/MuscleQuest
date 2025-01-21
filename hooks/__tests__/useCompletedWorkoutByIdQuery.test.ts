import { useCompletedWorkoutByIdQuery } from "../useCompletedWorkoutByIdQuery";
import { useQuery } from "@tanstack/react-query";
import { fetchCompletedWorkoutById } from "@/utils/database";

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

jest.mock("@/utils/database", () => ({
  fetchCompletedWorkoutById: jest.fn(),
}));

describe("useCompletedWorkoutByIdQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call useQuery with the correct arguments", () => {
    const mockUseQuery = useQuery as jest.Mock;
    const workoutId = 1;
    const weightUnit = "kg";

    // Call the hook
    useCompletedWorkoutByIdQuery(workoutId, weightUnit);

    // Assertions
    expect(mockUseQuery).toHaveBeenCalledWith({
      queryKey: ["completedWorkout", workoutId],
      queryFn: expect.any(Function),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    });

    // Ensure the query function calls the fetchCompletedWorkoutById function with correct args
    const { queryFn } = mockUseQuery.mock.calls[0][0];
    queryFn(); // Execute the query function
    expect(fetchCompletedWorkoutById).toHaveBeenCalledWith(
      workoutId,
      weightUnit,
    );
  });
});
