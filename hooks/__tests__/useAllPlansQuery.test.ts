import {
  transformRawPlans,
  fetchPlans,
  useAllPlansQuery,
} from "../useAllPlansQuery";
import { openDatabase } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@/utils/database", () => ({
  openDatabase: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("@bugsnag/expo");

const mockDb = {
  getAllAsync: jest.fn(),
};

(openDatabase as jest.Mock).mockResolvedValue(mockDb);

describe("useAllPlansQuery Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("transformRawPlans", () => {
    it("should transform raw plans into userPlans and appPlans", () => {
      const rawPlans = [
        {
          id: 1,
          name: "User Plan",
          image_url: "user-plan.jpg",
          is_active: 1,
          app_plan_id: null,
          workout_id: 101,
          workout_name: "Workout 1",
          exercise_id: 1001,
          exercise_name: "Exercise 1",
          description: "Test description",
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
        {
          id: 2,
          name: "App Plan",
          image_url: "app-plan.jpg",
          is_active: 0,
          app_plan_id: 1,
          workout_id: 201,
          workout_name: "Workout 2",
          exercise_id: 2001,
          exercise_name: "Exercise 2",
          description: "Test description 2",
          image: null,
          local_animated_uri: null,
          animated_url: null,
          equipment: "Barbell",
          body_part: "Legs",
          target_muscle: "Quads",
          secondary_muscles: null,
          tracking_type: "weight",
          sets: '[{"reps": 8, "weight": 100}]',
          exercise_order: 1,
        },
      ];

      const result = transformRawPlans(rawPlans);

      expect(result).toEqual({
        userPlans: [
          {
            id: 1,
            name: "User Plan",
            image_url: "user-plan.jpg",
            is_active: 1,
            app_plan_id: null,
            workouts: [
              {
                id: 101,
                name: "Workout 1",
                exercises: [
                  {
                    exercise_id: 1001,
                    name: "Exercise 1",
                    description: "Test description",
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
          },
        ],
        appPlans: [
          {
            id: 2,
            name: "App Plan",
            image_url: "app-plan.jpg",
            is_active: 0,
            app_plan_id: 1,
            workouts: [
              {
                id: 201,
                name: "Workout 2",
                exercises: [
                  {
                    exercise_id: 2001,
                    name: "Exercise 2",
                    description: "Test description 2",
                    image: [],
                    local_animated_uri: "",
                    animated_url: "",
                    equipment: "Barbell",
                    body_part: "Legs",
                    target_muscle: "Quads",
                    secondary_muscles: [],
                    tracking_type: "weight",
                    sets: [{ reps: 8, weight: 100 }],
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  describe("fetchPlans", () => {
    it("should fetch and transform plans correctly", async () => {
      const mockRawPlans = [
        {
          id: 1,
          name: "Plan 1",
          image_url: "plan-1.jpg",
          is_active: 1,
          app_plan_id: null,
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

      mockDb.getAllAsync.mockResolvedValueOnce(mockRawPlans);

      const result = await fetchPlans();

      expect(result.userPlans).toHaveLength(1);
      expect(result.appPlans).toHaveLength(0);
      expect(result.userPlans[0].name).toBe("Plan 1");
    });

    it("should handle and report database errors", async () => {
      const error = new Error("Database error");
      mockDb.getAllAsync.mockRejectedValueOnce(error);

      await expect(fetchPlans()).rejects.toThrow("Failed to fetch plans");
      expect(Bugsnag.notify).toHaveBeenCalledWith(error);
    });
  });

  describe("useAllPlansQuery", () => {
    it("should call useQuery with correct arguments", () => {
      (useQuery as jest.Mock).mockImplementation(() => ({
        data: null,
        isLoading: false,
        error: null,
      }));

      useAllPlansQuery();

      expect(useQuery).toHaveBeenCalledWith({
        queryKey: ["plans"],
        queryFn: fetchPlans,
        staleTime: 5 * 60 * 1000,
      });
    });
  });
});
