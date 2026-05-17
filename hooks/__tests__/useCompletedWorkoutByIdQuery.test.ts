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
    const distanceUnit = "m";

    useCompletedWorkoutByIdQuery(workoutId, weightUnit);

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryKey: ["completedWorkout", workoutId, weightUnit, distanceUnit],
      queryFn: expect.any(Function),
      enabled: true,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    });

    const { queryFn } = mockUseQuery.mock.calls[0][0];
    queryFn();
    expect(fetchCompletedWorkoutById).toHaveBeenCalledWith(
      workoutId,
      weightUnit,
      distanceUnit,
    );
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", NaN],
  ])("should disable the query for invalid id: %s", (_, workoutId) => {
    const mockUseQuery = useQuery as jest.Mock;

    useCompletedWorkoutByIdQuery(workoutId, "kg");

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
