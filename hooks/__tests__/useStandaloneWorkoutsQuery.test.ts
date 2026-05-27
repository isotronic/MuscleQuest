import {
  fetchStandaloneWorkouts,
  useStandaloneWorkoutsQuery,
} from "../useStandaloneWorkoutsQuery";
import { getStandaloneWorkouts } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  getStandaloneWorkouts: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

describe("fetchStandaloneWorkouts", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns standalone workouts from the database", async () => {
    const workouts = [{ id: 1, name: "Quick Workout", exercises: [] }];
    (getStandaloneWorkouts as jest.Mock).mockResolvedValue(workouts);

    const result = await fetchStandaloneWorkouts();

    expect(result).toEqual(workouts);
  });

  it("notifies Bugsnag and rethrows on error", async () => {
    const error = new Error("db error");
    (getStandaloneWorkouts as jest.Mock).mockRejectedValue(error);

    await expect(fetchStandaloneWorkouts()).rejects.toThrow("db error");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

describe("useStandaloneWorkoutsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['standaloneWorkouts']", () => {
    useStandaloneWorkoutsQuery();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["standaloneWorkouts"],
        queryFn: fetchStandaloneWorkouts,
      }),
    );
  });
});
