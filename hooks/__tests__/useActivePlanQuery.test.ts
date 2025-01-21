import { fetchActivePlanData, useActivePlanQuery } from "../useActivePlanQuery";
// import { openDatabase } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("@bugsnag/expo");

const mockDb = {
  getAllAsync: jest.fn(),
};

describe("fetchActivePlanData", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return null if no active plan is found", async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await fetchActivePlanData();

    expect(result).toBeNull();
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.any(String));
  });

  it("should parse and return the active plan with workouts and exercises", async () => {
    const mockData = [
      {
        id: 1,
        name: "Plan A",
        image_url: "plan-a.jpg",
        is_active: 1,
        workout_id: 101,
        workout_name: "Workout 1",
        exercise_id: 1001,
        exercise_name: "Exercise 1",
        description: "Description 1",
        image: null,
        local_animated_uri: null,
        animated_url: null,
        equipment: "Dumbbells",
        body_part: "Chest",
        target_muscle: "Pectorals",
        secondary_muscles: '["Triceps"]',
        tracking_type: "weight",
        sets: '[{"reps": 10, "weight": 20}]',
        exercise_order: 1,
      },
    ];

    mockDb.getAllAsync.mockResolvedValueOnce(mockData);

    const result = await fetchActivePlanData();

    expect(result).toEqual({
      id: 1,
      name: "Plan A",
      image_url: "plan-a.jpg",
      is_active: 1,
      workouts: [
        {
          id: 101,
          name: "Workout 1",
          exercises: [
            {
              exercise_id: 1001,
              name: "Exercise 1",
              description: "Description 1",
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "Dumbbells",
              body_part: "Chest",
              target_muscle: "Pectorals",
              secondary_muscles: ["Triceps"],
              tracking_type: "weight",
              sets: [{ reps: 10, weight: 20 }],
            },
          ],
        },
      ],
    });
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.any(String));
  });

  it("should handle and report errors", async () => {
    const error = new Error("Database error");
    mockDb.getAllAsync.mockRejectedValueOnce(error);

    const result = await fetchActivePlanData();

    expect(result).toBeNull();
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

describe("useActivePlanQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call useQuery with the correct arguments", () => {
    (useQuery as jest.Mock).mockImplementation(() => ({
      data: null,
      isLoading: false,
      error: null,
    }));

    useActivePlanQuery();

    expect(useQuery).toHaveBeenCalledWith({
      queryKey: ["activePlan"],
      queryFn: fetchActivePlanData,
      staleTime: 5 * 60 * 1000,
    });
  });
});
