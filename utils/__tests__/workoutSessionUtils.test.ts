import {
  computeNextIndices,
  computePreviousIndices,
  checkSetPosition,
  findSetDataFromPreviousWorkouts,
  getSetValues,
  CompletedWorkout,
} from "../workoutSessionUtils";

describe("workoutSessionUtils", () => {
  // Mock workout data for testing
  const mockWorkout = {
    exercises: [
      {
        exercise_id: 1,
        name: "Exercise 1",
        sets: [
          { restMinutes: 1, restSeconds: 30 },
          { restMinutes: 1, restSeconds: 30 },
        ],
      },
      {
        exercise_id: 2,
        name: "Exercise 2",
        sets: [
          { restMinutes: 1, restSeconds: 30 },
          { restMinutes: 1, restSeconds: 30 },
          { restMinutes: 1, restSeconds: 30 },
        ],
      },
    ],
  };

  // Mock previous workout data that matches the CompletedWorkout type
  const mockPreviousWorkoutData: CompletedWorkout[] = [
    {
      id: 1,
      workout_id: 1,
      plan_id: 1,
      workout_name: "Test Workout",
      date_completed: "2023-01-01T00:00:00.000Z",
      duration: 3600,
      total_sets_completed: 5,
      exercises: [
        {
          exercise_id: 1,
          exercise_name: "Exercise 1",
          exercise_tracking_type: "weight",
          sets: [
            { set_id: 1, set_number: 1, weight: 50, reps: 10, time: 0 },
            { set_id: 2, set_number: 2, weight: 55, reps: 8, time: 0 },
          ],
        },
        {
          exercise_id: 2,
          exercise_name: "Exercise 2",
          exercise_tracking_type: "weight",
          sets: [
            { set_id: 3, set_number: 1, weight: 40, reps: 12, time: 0 },
            { set_id: 4, set_number: 2, weight: 45, reps: 10, time: 0 },
            { set_id: 5, set_number: 3, weight: 50, reps: 8, time: 0 },
          ],
        },
      ],
    },
  ];

  // Mock weight and reps data
  const mockWeightAndReps = {
    0: {
      0: { weight: "60", reps: "10", time: "0" },
      1: { weight: "65", reps: "8", time: "0" },
    },
    1: {
      0: { weight: "45", reps: "12", time: "0" },
      1: { weight: "50", reps: "10", time: "0" },
      2: { weight: "55", reps: "8", time: "0" },
    },
  };

  describe("computeNextIndices", () => {
    it("should compute next indices within the same exercise", () => {
      const result = computeNextIndices(mockWorkout, 0, 0);
      expect(result).toEqual({
        nextExerciseIndex: 0,
        nextSetIndex: 1,
        hasNextSet: true,
      });
    });

    it("should compute next indices for the next exercise", () => {
      const result = computeNextIndices(mockWorkout, 0, 1);
      expect(result).toEqual({
        nextExerciseIndex: 1,
        nextSetIndex: 0,
        hasNextSet: true,
      });
    });

    it("should handle the last set of the last exercise", () => {
      const result = computeNextIndices(mockWorkout, 1, 2);
      expect(result).toEqual({
        nextExerciseIndex: 2,
        nextSetIndex: 0,
        hasNextSet: false,
      });
    });

    it("should handle null workout", () => {
      const result = computeNextIndices(null, 0, 0);
      expect(result).toEqual({
        nextExerciseIndex: 0,
        nextSetIndex: 1,
        hasNextSet: false,
      });
    });
  });

  describe("computePreviousIndices", () => {
    it("should compute previous indices within the same exercise", () => {
      const result = computePreviousIndices(mockWorkout, 0, 1);
      expect(result).toEqual({
        previousExerciseIndex: 0,
        previousSetIndex: 0,
        hasPreviousSet: true,
      });
    });

    it("should compute previous indices for the previous exercise", () => {
      const result = computePreviousIndices(mockWorkout, 1, 0);
      expect(result).toEqual({
        previousExerciseIndex: 0,
        previousSetIndex: 1,
        hasPreviousSet: true,
      });
    });

    it("should handle the first set of the first exercise", () => {
      const result = computePreviousIndices(mockWorkout, 0, 0);
      expect(result).toEqual({
        previousExerciseIndex: null,
        previousSetIndex: null,
        hasPreviousSet: false,
      });
    });

    it("should handle null workout", () => {
      const result = computePreviousIndices(null, 0, 0);
      expect(result).toEqual({
        previousExerciseIndex: null,
        previousSetIndex: null,
        hasPreviousSet: false,
      });
    });
  });

  describe("checkSetPosition", () => {
    it("should identify the first set of the first exercise", () => {
      const result = checkSetPosition(
        mockWorkout,
        0,
        0,
        mockWorkout.exercises[0],
      );
      expect(result).toEqual({ isFirst: true, isLast: false });
    });

    it("should identify the last set of the last exercise", () => {
      const result = checkSetPosition(
        mockWorkout,
        1,
        2,
        mockWorkout.exercises[1],
      );
      expect(result).toEqual({ isFirst: false, isLast: true });
    });

    it("should identify a middle set", () => {
      const result = checkSetPosition(
        mockWorkout,
        0,
        1,
        mockWorkout.exercises[0],
      );
      expect(result).toEqual({ isFirst: false, isLast: false });
    });

    it("should handle null values", () => {
      const result = checkSetPosition(null, null, null, null);
      expect(result).toEqual({ isFirst: false, isLast: false });
    });
  });

  describe("findSetDataFromPreviousWorkouts", () => {
    it("should find set data for an existing exercise and set", () => {
      const result = findSetDataFromPreviousWorkouts(
        mockPreviousWorkoutData,
        1,
        0,
      );
      expect(result).toEqual({
        set_id: 1,
        set_number: 1,
        weight: 50,
        reps: 10,
        time: 0,
      });
    });

    it("should return null for non-existent exercise", () => {
      const result = findSetDataFromPreviousWorkouts(
        mockPreviousWorkoutData,
        3,
        0,
      );
      expect(result).toBeNull();
    });

    it("should return null for non-existent set", () => {
      const result = findSetDataFromPreviousWorkouts(
        mockPreviousWorkoutData,
        1,
        5,
      );
      expect(result).toBeNull();
    });

    it("should handle null previous workout data", () => {
      const result = findSetDataFromPreviousWorkouts(null, 1, 0);
      expect(result).toBeNull();
    });
  });

  describe("getSetValues", () => {
    it("should get values from weightAndReps if available", () => {
      const result = getSetValues(mockWeightAndReps, 0, 0, null);
      expect(result).toEqual({
        weight: "60",
        reps: "10",
        time: "0",
      });
    });

    it("should fall back to previous set data if weightAndReps not available", () => {
      const mockPreviousSetData = { weight: 50, reps: 10, time: 0 };
      const result = getSetValues({}, 0, 0, mockPreviousSetData);
      expect(result).toEqual({
        weight: "50",
        reps: "10",
        time: "0",
      });
    });

    it("should return empty strings if no data available", () => {
      const result = getSetValues({}, 0, 0, null);
      expect(result).toEqual({
        weight: "",
        reps: "",
        time: "",
      });
    });

    it("should handle null indices", () => {
      const result = getSetValues(mockWeightAndReps, null, null, null);
      expect(result).toEqual({
        weight: "",
        reps: "",
        time: "",
      });
    });
  });
});
