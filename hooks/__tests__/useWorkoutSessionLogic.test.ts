import { renderHook, act } from "@testing-library/react-native";
import { useWorkoutSessionLogic } from "../useWorkoutSessionLogic";
import * as utility from "@/utils/utility";

// Mock functions
const mockUpdateWeightAndReps = jest.fn();
const mockNextSet = jest.fn();
const mockSetCurrentExerciseIndex = jest.fn();
const mockSetCurrentSetIndex = jest.fn();
const mockInitializeWeightAndReps = jest.fn();
const mockRemoveSet = jest.fn();

// Mock modules
jest.mock("@/store/activeWorkoutStore", () => ({
  useActiveWorkoutStore: () => ({
    workout: null,
    currentExerciseIndex: 0,
    currentSetIndices: {},
    weightAndReps: {},
    completedSets: {},
    previousWorkoutData: null,
    updateWeightAndReps: mockUpdateWeightAndReps,
    nextSet: mockNextSet,
    setCurrentExerciseIndex: mockSetCurrentExerciseIndex,
    setCurrentSetIndex: mockSetCurrentSetIndex,
    initializeWeightAndReps: mockInitializeWeightAndReps,
    removeSet: mockRemoveSet,
  }),
}));

jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn((_title, _message, buttons) => {
      // Simulate clicking the "Delete" button
      const deleteButton = buttons.find(
        (button: { text: string }) => button.text === "Delete",
      );
      if (deleteButton) {
        deleteButton.onPress();
      }
    }),
  },
}));

jest.mock("@/utils/utility", () => ({
  convertTimeStrToSeconds: jest.fn((timeStr) => {
    if (!timeStr) return 0;
    if (timeStr.length <= 2) return parseInt(timeStr) || 0;
    const minutes = parseInt(timeStr.slice(0, -2)) || 0;
    const seconds = parseInt(timeStr.slice(-2)) || 0;
    return minutes * 60 + seconds;
  }),
  formatFromTotalSeconds: jest.fn((totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }),
}));

// Create a mock workout for testing
const createMockWorkout = () => ({
  name: "Test Workout",
  exercises: [
    {
      exercise_id: 1,
      name: "Bench Press",
      tracking_type: "weight",
      sets: [
        {
          restMinutes: 1,
          restSeconds: 30,
          repsMin: 8,
          repsMax: 12,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
        {
          restMinutes: 1,
          restSeconds: 30,
          repsMin: 8,
          repsMax: 12,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
      ],
    },
    {
      exercise_id: 2,
      name: "Squat",
      tracking_type: "weight",
      sets: [
        {
          restMinutes: 2,
          restSeconds: 0,
          repsMin: 5,
          repsMax: 8,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
      ],
    },
    {
      exercise_id: 3,
      name: "Plank",
      tracking_type: "time",
      sets: [
        {
          restMinutes: 1,
          restSeconds: 0,
          time: 60,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
      ],
    },
  ],
});

// Create mock previous workout data
const createMockPreviousWorkoutData = () => [
  {
    id: 1,
    workout_id: 1,
    date_completed: "2023-01-01T00:00:00.000Z", // Fixed date for consistent tests
    duration: 3600,
    exercises: [
      {
        exercise_id: 1,
        name: "Bench Press",
        sets: [
          { weight: 80, reps: 10 },
          { weight: 85, reps: 8 },
        ],
      },
      {
        exercise_id: 2,
        name: "Squat",
        sets: [{ weight: 100, reps: 6 }],
      },
      {
        exercise_id: 3,
        name: "Plank",
        sets: [{ time: 60 }],
      },
    ],
  },
];

describe("useWorkoutSessionLogic", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it("should initialize correctly with empty state", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: null,
        currentExerciseIndex: 0,
        currentSetIndices: {},
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    expect(result.current.currentSet).toBeUndefined();
    expect(result.current.currentExercise).toBeUndefined();
    expect(result.current.weight).toBe("");
    expect(result.current.reps).toBe("");
    expect(result.current.time).toBe("");
    expect(result.current.hasNextSet).toBe(false);
    expect(result.current.hasPreviousSet).toBe(false);
  });

  it("should initialize correctly with workout data", () => {
    const mockWorkout = createMockWorkout();

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        setCurrentExerciseIndex: mockSetCurrentExerciseIndex,
        setCurrentSetIndex: mockSetCurrentSetIndex,
        updateWeightAndReps: mockUpdateWeightAndReps,
        initializeWeightAndReps: mockInitializeWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    expect(result.current.currentExercise).toEqual(mockWorkout.exercises[0]);
    expect(result.current.currentSet).toEqual(mockWorkout.exercises[0].sets[0]);
    expect(result.current.hasNextSet).toBe(true);
    expect(result.current.nextExerciseIndex).toBe(0);
    expect(result.current.nextSetIndex).toBe(1);
    expect(result.current.hasPreviousSet).toBe(false);
    expect(result.current.currentIsFirstSetOfFirstExercise).toBe(true);
    expect(result.current.currentIsLastSetOfLastExercise).toBe(false);
  });

  it("should handle weight input change", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleWeightInputChange("50.5");
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "50.5", // weight
      "", // reps
      "", // time
    );
  });

  it("should sanitize weight input by removing non-numeric characters", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleWeightInputChange("50.5kg");
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "50.5", // weight (sanitized)
      "", // reps
      "", // time
    );
  });

  it("should handle reps input change", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60" } } },
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleRepsInputChange("12");
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "60", // weight
      "12", // reps
      "", // time
    );
  });

  it("should handle time input change", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 2, // Plank exercise with time tracking
        currentSetIndices: { 2: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleTimeInputChange("130"); // 1:30
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      2, // exerciseIndex
      0, // setIndex
      "", // weight
      "", // reps
      "130", // time
    );
  });

  it("should handle weight change with increment/decrement", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60" } } },
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleWeightChange(2.5); // Increment by 2.5
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "62.5", // weight (60 + 2.5)
      "", // reps
      "", // time
    );

    // Test decrement
    mockUpdateWeightAndReps.mockClear();
    act(() => {
      result.current.handleWeightChange(-5); // Decrement by 5
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "55.0", // weight (60 - 5)
      "", // reps
      "", // time
    );
  });

  it("should handle reps change with increment/decrement", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData: null,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleRepsChange(1); // Increment by 1
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "60", // weight
      "11", // reps (10 + 1)
      "", // time
    );

    // Test decrement
    mockUpdateWeightAndReps.mockClear();
    act(() => {
      result.current.handleRepsChange(-2); // Decrement by 2
    });

    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "60", // weight
      "8", // reps (10 - 2)
      "", // time
    );
  });

  it("should handle complete set", () => {
    const convertTimeStrToSecondsSpy = jest.spyOn(
      utility,
      "convertTimeStrToSeconds",
    );

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData: null,
        nextSet: mockNextSet,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.handleCompleteSet();
    });

    // Verify that updateWeightAndReps was called with the correct values
    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      0, // exerciseIndex
      0, // setIndex
      "60", // weight
      "10", // reps
      "0", // time (converted to seconds)
    );

    // Verify that convertTimeStrToSeconds was called
    expect(convertTimeStrToSecondsSpy).toHaveBeenCalled();

    // Verify that nextSet was called to move to the next set
    expect(mockNextSet).toHaveBeenCalled();
  });

  it("should handle complete set for the last set of the last exercise", () => {
    const mockWorkout = createMockWorkout();
    const lastExerciseIndex = mockWorkout.exercises.length - 1;
    const lastSetIndex =
      mockWorkout.exercises[lastExerciseIndex].sets.length - 1;

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: lastExerciseIndex,
        currentSetIndices: { [lastExerciseIndex]: lastSetIndex },
        weightAndReps: {
          [lastExerciseIndex]: {
            [lastSetIndex]: { time: "60" }, // Plank is a time-based exercise
          },
        },
        completedSets: {},
        previousWorkoutData: null,
        nextSet: mockNextSet,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // Verify that we're on the last set of the last exercise
    expect(result.current.currentIsLastSetOfLastExercise).toBe(true);
    expect(result.current.hasNextSet).toBe(false);

    act(() => {
      result.current.handleCompleteSet();
    });

    // Verify that updateWeightAndReps was called with the correct values
    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      lastExerciseIndex,
      lastSetIndex,
      "0", // weight (not used for time-based exercise)
      "0", // reps (not used for time-based exercise)
      "60", // time in seconds
    );

    // Verify that nextSet was called to complete the workout
    expect(mockNextSet).toHaveBeenCalled();
  });

  it("should handle complete set for a time-based exercise", () => {
    const convertTimeStrToSecondsSpy = jest.spyOn(
      utility,
      "convertTimeStrToSeconds",
    );

    const mockWorkout = createMockWorkout();
    // Use the Plank exercise which is time-based (index 2)
    const timeExerciseIndex = 2;
    const timeSetIndex = 0;

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: timeExerciseIndex,
        currentSetIndices: { [timeExerciseIndex]: timeSetIndex },
        weightAndReps: {
          [timeExerciseIndex]: {
            [timeSetIndex]: { time: "1:30" }, // 1 minute 30 seconds
          },
        },
        completedSets: {},
        previousWorkoutData: null,
        nextSet: mockNextSet,
        updateWeightAndReps: mockUpdateWeightAndReps,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // Verify that we're on a time-based exercise
    expect(result.current.currentExercise?.tracking_type).toBe("time");

    act(() => {
      result.current.handleCompleteSet();
    });

    // Verify that convertTimeStrToSeconds was called with the time string
    expect(convertTimeStrToSecondsSpy).toHaveBeenCalledWith("1:30");

    // Verify that updateWeightAndReps was called with the correct values
    // The time "1:30" should be converted to 90 seconds
    expect(mockUpdateWeightAndReps).toHaveBeenCalledWith(
      timeExerciseIndex,
      timeSetIndex,
      "0", // weight (not used for time-based exercise)
      "0", // reps (not used for time-based exercise)
      "90", // time converted to seconds (1:30 = 90 seconds)
    );

    // Verify that nextSet was called to move to the next set
    expect(mockNextSet).toHaveBeenCalled();
  });

  it("should handle getNextSetData", () => {
    const mockWorkout = createMockWorkout();

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData: null,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    const nextSetData = result.current.getNextSetData();

    // Since there's no previous workout data, it should carry over the weight
    expect(nextSetData).toEqual({
      weight: "60", // Carried over from current set
      reps: "",
      time: "",
    });
  });

  it("should handle setCurrentExerciseAndSetIndex", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        setCurrentExerciseIndex: mockSetCurrentExerciseIndex,
        setCurrentSetIndex: mockSetCurrentSetIndex,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    act(() => {
      result.current.setCurrentExerciseAndSetIndex(1, 0);
    });

    expect(mockSetCurrentExerciseIndex).toHaveBeenCalledWith(1);
    expect(mockSetCurrentSetIndex).toHaveBeenCalledWith(1, 0);
  });

  it("should handle remove set", () => {
    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        removeSet: mockRemoveSet,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // Mock Alert.alert to simulate clicking "Delete"
    const mockAlert = jest.fn((_title, _message, buttons) => {
      const deleteButton = buttons.find(
        (button: { text: string }) => button.text === "Delete",
      );
      if (deleteButton && deleteButton.onPress) {
        deleteButton.onPress();
      }
    });

    // Replace the real Alert.alert with our mock
    const originalAlert = require("react-native").Alert.alert;
    require("react-native").Alert.alert = mockAlert;

    act(() => {
      result.current.handleRemoveSet(1);
    });

    // Restore the original Alert.alert
    require("react-native").Alert.alert = originalAlert;

    expect(mockRemoveSet).toHaveBeenCalledWith(1);
  });

  it("should initialize with workout history", () => {
    const mockWorkoutHistory = JSON.stringify(createMockPreviousWorkoutData());

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: createMockWorkout(),
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
        initializeWeightAndReps: mockInitializeWeightAndReps,
      }));

    renderHook(() => useWorkoutSessionLogic(undefined, mockWorkoutHistory));

    expect(mockInitializeWeightAndReps).toHaveBeenCalled();
    // Verify that the parsed workout history was passed to initializeWeightAndReps
    expect(mockInitializeWeightAndReps.mock.calls[0][0]).toEqual(
      createMockPreviousWorkoutData(),
    );
  });

  it("should handle position indicators correctly for last set of last exercise", () => {
    const mockWorkout = createMockWorkout();
    const lastExerciseIndex = mockWorkout.exercises.length - 1;
    const lastExercise = mockWorkout.exercises[lastExerciseIndex];
    const lastSetIndex = lastExercise.sets.length - 1;

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: lastExerciseIndex,
        currentSetIndices: { [lastExerciseIndex]: lastSetIndex },
        weightAndReps: {},
        completedSets: {},
        previousWorkoutData: null,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    expect(result.current.currentIsLastSetOfLastExercise).toBe(true);
    expect(result.current.currentIsFirstSetOfFirstExercise).toBe(false);
    expect(result.current.hasNextSet).toBe(false);
  });

  it("should handle previous set data correctly", () => {
    const mockWorkout = createMockWorkout();

    // Setup the mock implementation for this test
    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 1, // Second exercise
        currentSetIndices: { 1: 0 },
        weightAndReps: {
          0: {
            0: { weight: "60", reps: "10" },
            1: { weight: "65", reps: "8" },
          },
        },
        completedSets: { 0: { 0: true, 1: true } },
        previousWorkoutData: null,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    expect(result.current.hasPreviousSet).toBe(true);
    expect(result.current.previousExerciseIndex).toBe(0);
    expect(result.current.previousSetIndex).toBe(1); // Last set of previous exercise
    expect(result.current.previousExercise).toEqual(mockWorkout.exercises[0]);
    expect(result.current.previousSet).toEqual(
      mockWorkout.exercises[0].sets[1],
    );
  });

  it("should use previous workout data for the next set", () => {
    const mockWorkout = createMockWorkout();
    // Create a properly structured previousWorkoutData array that matches what the hook expects
    const previousWorkoutData = createMockPreviousWorkoutData();

    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    expect(result.current.nextWeight).toBe("85"); // Weight from previous workout data (see createMockPreviousWorkoutData)
    expect(result.current.nextReps).toBe("8"); // Reps from previous workout data (see createMockPreviousWorkoutData)
    expect(result.current.nextTime).toBe(""); // No time data for weight-based exercise
  });

  it("should reset weight and reps when current set is marked as warmup", () => {
    const mockWorkout = createMockWorkout();
    // Mark current set as warmup so that weight/reps are not carried over
    mockWorkout.exercises[0].sets[0].isWarmup = true;

    // Create previous workout data to test the logic
    const previousWorkoutData = createMockPreviousWorkoutData();

    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // For warmup sets, the weight should be taken from previous workout data
    // instead of carrying over from the current set
    expect(result.current.nextWeight).toBe("85"); // Weight from previous workout data
    expect(result.current.nextReps).toBe("8"); // Reps from previous workout data
    expect(result.current.nextTime).toBe(""); // No time data for weight-based exercise
  });

  it("should reset weight when next set is marked as drop set", () => {
    const mockWorkout = createMockWorkout();
    // Mark the next set as a drop set
    mockWorkout.exercises[0].sets[1].isDropSet = true;

    // Create previous workout data to test the logic
    const previousWorkoutData = createMockPreviousWorkoutData();

    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
        weightAndReps: { 0: { 0: { weight: "60", reps: "10" } } },
        completedSets: {},
        previousWorkoutData,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // For drop sets, the weight should be taken from previous workout data
    // instead of carrying over from the current set
    expect(result.current.nextWeight).toBe("85"); // Weight from previous workout data
    expect(result.current.nextReps).toBe("8"); // Reps from previous workout data
    expect(result.current.nextTime).toBe(""); // No time data for weight-based exercise
  });

  it("should handle transition to the first set of the next exercise", () => {
    const mockWorkout = createMockWorkout();
    // Add a new exercise with proper set structure
    mockWorkout.exercises.push({
      exercise_id: 999,
      name: "New Exercise",
      tracking_type: "weight",
      sets: [
        {
          restMinutes: 1,
          restSeconds: 30,
          repsMin: 8,
          repsMax: 12,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
        {
          restMinutes: 1,
          restSeconds: 30,
          repsMin: 8,
          repsMax: 12,
          isWarmup: false,
          isDropSet: false,
          isToFailure: false,
        },
      ],
    });

    // Create previous workout data to test the logic
    const previousWorkoutData = createMockPreviousWorkoutData();
    // Add data for the new exercise to the previous workout data
    previousWorkoutData[0].exercises.push({
      exercise_id: 999,
      name: "New Exercise",
      sets: [
        { weight: 50, reps: 12 },
        { weight: 55, reps: 10 },
      ],
    });

    jest
      .spyOn(require("@/store/activeWorkoutStore"), "useActiveWorkoutStore")
      .mockImplementation(() => ({
        workout: mockWorkout,
        // Set current exercise index to the first one and the current set index to the last set of that exercise
        currentExerciseIndex: 0,
        currentSetIndices: { 0: mockWorkout.exercises[0].sets.length - 1 },
        weightAndReps: {
          0: {
            [mockWorkout.exercises[0].sets.length - 1]: {
              weight: "60",
              reps: "10",
            },
          },
        },
        completedSets: {},
        previousWorkoutData,
      }));

    const { result } = renderHook(() =>
      useWorkoutSessionLogic(undefined, undefined),
    );

    // Verify that we're transitioning to the next exercise
    expect(result.current.nextExerciseIndex).toBe(1);
    expect(result.current.nextSetIndex).toBe(0);

    // When transitioning to a new exercise, the weight and reps should come from previous workout data
    // or be empty if no previous data exists
    expect(result.current.nextWeight).toBe("100"); // Weight from previous workout data for the next exercise (Squat)
    expect(result.current.nextReps).toBe("6"); // Reps from previous workout data for the next exercise (Squat)
    expect(result.current.nextTime).toBe(""); // No time data for weight-based exercise
  });
});
