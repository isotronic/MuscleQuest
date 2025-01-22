// activeWorkoutStore.test.ts
import { act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import { router } from "expo-router";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

describe("useActiveWorkoutStore", () => {
  beforeEach(() => {
    // Reset the store to a "blank" state before each test
    useActiveWorkoutStore.setState({
      activeWorkout: null,
      workout: null,
      originalWorkout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      previousWorkoutData: null,
      startTime: null,
      timerRunning: false,
      timerExpiry: null,
    });
    jest.clearAllMocks();
  });

  it("initial state should be correct", () => {
    const state = useActiveWorkoutStore.getState();
    expect(state.activeWorkout).toBeNull();
    expect(state.workout).toBeNull();
    expect(state.currentExerciseIndex).toBe(0);
    expect(state.timerRunning).toBe(false);
  });

  it("setWorkout should initialize a new active workout", () => {
    const fakeWorkout = {
      id: 1,
      name: "Fake Workout",
      exercises: [
        {
          exercise_id: 101,
          name: "Squat",
          sets: [],
        },
      ],
    };

    act(() => {
      useActiveWorkoutStore
        .getState()
        .setWorkout(fakeWorkout as any, 10, 20, "Legs Day");
    });

    const {
      activeWorkout,
      workout,
      originalWorkout,
      startTime,
      timerRunning,
      timerExpiry,
    } = useActiveWorkoutStore.getState();

    expect(activeWorkout).toEqual({
      planId: 10,
      workoutId: 20,
      name: "Legs Day",
    });
    expect(workout?.name).toBe("Fake Workout");
    expect(originalWorkout?.name).toBe("Fake Workout");
    expect(startTime).toBeInstanceOf(Date);
    expect(timerRunning).toBe(false);
    expect(timerExpiry).toBeNull();
  });

  it("isWorkoutInProgress should return true when activeWorkout and workout are set", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        activeWorkout: { planId: 1, workoutId: 2, name: "Test" },
        workout: { id: 1, name: "Some Workout", exercises: [] },
      });
    });
    const result = useActiveWorkoutStore.getState().isWorkoutInProgress();
    expect(result).toBe(true);
  });

  it("isWorkoutInProgress should return false when no activeWorkout is set", () => {
    const result = useActiveWorkoutStore.getState().isWorkoutInProgress();
    expect(result).toBe(false);
  });

  it("getActiveWorkoutId should return the workoutId if activeWorkout exists", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        activeWorkout: { planId: 1, workoutId: 99, name: "Test" },
      });
    });
    const result = useActiveWorkoutStore.getState().getActiveWorkoutId();
    expect(result).toBe(99);
  });

  it("getActiveWorkoutId should return null if no activeWorkout is set", () => {
    const result = useActiveWorkoutStore.getState().getActiveWorkoutId();
    expect(result).toBeNull();
  });

  it("setCurrentExerciseIndex should correctly change currentExerciseIndex and setIndices", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          id: 1,
          name: "Workout with 2 exercises",
          exercises: [
            {
              exercise_id: 101,
              name: "Push-ups",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
            {
              exercise_id: 102,
              name: "Squats",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
          is_deleted: false,
        },
        currentSetIndices: {
          0: 1, // Currently on set index 1 of the first exercise
        },
        completedSets: {
          0: { 0: true, 1: true }, // The first exercise's 2 sets are completed
        },
      });
    });

    act(() => {
      // Move to second exercise (index = 1)
      useActiveWorkoutStore.getState().setCurrentExerciseIndex(1);
    });

    const { currentExerciseIndex, currentSetIndices } =
      useActiveWorkoutStore.getState();

    // Because first exercise is completed, we set the second exercise's currentSetIndex to 0
    expect(currentExerciseIndex).toBe(1);
    expect(currentSetIndices[1]).toBe(0);
  });

  it("setCurrentSetIndex should correctly update the set index for a specific exercise", () => {
    act(() => {
      useActiveWorkoutStore.getState().setCurrentSetIndex(2, 5);
    });
    const { currentSetIndices } = useActiveWorkoutStore.getState();
    expect(currentSetIndices[2]).toBe(5);
  });

  it("nextSet should move to the next set within the same exercise", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Test Workout",
          exercises: [
            {
              exercise_id: 200,
              name: "Bench Press",
              tracking_type: "weight",
              sets: [
                {
                  isWarmup: false,
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  isWarmup: false,
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  isWarmup: false,
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
      });
    });

    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const { currentSetIndices, completedSets } =
      useActiveWorkoutStore.getState();

    // Should have completed set 0, now on set index 1
    expect(currentSetIndices[0]).toBe(1);
    expect(completedSets[0][0]).toBe(true);
  });

  it("nextSet should move to the next exercise if all sets in the current exercise are completed", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Test Workout 2",
          exercises: [
            {
              exercise_id: 300,
              name: "Exercise A",
              tracking_type: "weight",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
            {
              exercise_id: 400,
              name: "Exercise B",
              tracking_type: "weight",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 1 }, // Currently on the last set
        completedSets: { 0: { 0: true } },
      });
    });

    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const { currentExerciseIndex, currentSetIndices, completedSets } =
      useActiveWorkoutStore.getState();

    // Since exercise 0 had 2 sets, after completing the last set, it should move to exercise 1
    expect(currentExerciseIndex).toBe(1);
    expect(currentSetIndices[0]).toBe(2); // It's set to the next set index (2, but that doesn't exist, so we moved on)
    expect(completedSets[0][1]).toBe(true);
  });

  it("nextSet should call router.back if all exercises are completed", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Test Workout 3",
          exercises: [
            {
              exercise_id: 500,
              name: "Exercise A",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 0 },
      });
    });

    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    // Because there's only 1 set in 1 exercise, nextSet will complete it and call router.back
    expect(router.back).toHaveBeenCalled();
  });

  it("addSet should duplicate the last set of the current exercise and reset its completed status", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Add Set Test Workout",
          exercises: [
            {
              exercise_id: 600,
              name: "Exercise with multiple sets",
              tracking_type: "weight",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        currentExerciseIndex: 0,
        completedSets: { 0: { 0: true, 1: true } },
        weightAndReps: {
          0: {
            0: { weight: "50", reps: "10" },
            1: { weight: "55", reps: "8" },
          },
        },
      });
    });

    act(() => {
      useActiveWorkoutStore.getState().addSet();
    });

    const { workout, completedSets, weightAndReps } =
      useActiveWorkoutStore.getState();

    // Should now have 3 sets
    expect(workout?.exercises[0].sets.length).toBe(3);

    // Completed sets for the new set (index 2) should be false
    expect(completedSets[0][2]).toBe(false);

    // weightAndReps for the new set should copy the last set's values
    expect(weightAndReps[0][2]).toEqual({ weight: "55", reps: "8" });
  });

  it("removeSet should remove a set from the current exercise if more than one set exists", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Remove Set Test Workout",
          exercises: [
            {
              exercise_id: 700,
              name: "Exercise with multiple sets",
              tracking_type: "weight",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        currentExerciseIndex: 0,
        currentSetIndices: { 0: 2 },
        completedSets: { 0: { 0: true, 1: false, 2: true } },
        weightAndReps: {
          0: {
            0: { weight: "50", reps: "10" },
            1: { weight: "55", reps: "8" },
            2: { weight: "60", reps: "6" },
          },
        },
      });
    });

    act(() => {
      // Remove the middle set
      useActiveWorkoutStore.getState().removeSet(1);
    });

    const { workout, completedSets, weightAndReps, currentSetIndices } =
      useActiveWorkoutStore.getState();

    expect(workout?.exercises[0].sets.length).toBe(2); // Now only 2 sets
    expect(workout?.exercises[0].sets[1]).toBeDefined(); // Original third set is now index 1
    // The removed set's completedSets and weightAndReps should be gone
    expect(completedSets[0][1]).toBeUndefined();
    expect(weightAndReps[0][1]).toBeUndefined();
    // currentSetIndices should also be adjusted if necessary
    expect(currentSetIndices[0]).toBe(1);
  });

  it("updateWeightAndReps should update the appropriate fields based on tracking type", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Update Weights Test",
          exercises: [
            {
              exercise_id: 800,
              name: "Exercise with weight type",
              tracking_type: "weight",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
            {
              exercise_id: 900,
              name: "Exercise with time type",
              tracking_type: "time",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
      });
    });

    act(() => {
      // Weight-based
      useActiveWorkoutStore.getState().updateWeightAndReps(0, 0, "100", "12");
      // Time-based
      useActiveWorkoutStore
        .getState()
        .updateWeightAndReps(1, 0, undefined, undefined, "60");
    });

    const { weightAndReps } = useActiveWorkoutStore.getState();
    expect(weightAndReps[0][0]).toEqual({ weight: "100", reps: "12" });
    expect(weightAndReps[1][0]).toEqual({ time: "60" });
  });

  it("initializeWeightAndReps should store the previous workout data in the store", () => {
    const mockPreviousData = {
      workout_id: 123,
      workout_name: "Previous Completed Workout",
      date: new Date().toISOString(),
      exercises: [],
    };

    act(() => {
      // Provide a current workout so the store won't early-return
      useActiveWorkoutStore.setState({
        workout: {
          workout_id: 999,
          workout_name: "Some Ongoing Workout",
          exercises: [],
        } as any,
      });

      useActiveWorkoutStore
        .getState()
        .initializeWeightAndReps(mockPreviousData as any);
    });

    const { previousWorkoutData } = useActiveWorkoutStore.getState();
    expect(previousWorkoutData?.workout_name).toBe(
      "Previous Completed Workout",
    );
  });

  it("replaceExercise should replace the exercise at a given index, resetting sets and completions", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Replace Exercise Test",
          exercises: [
            {
              exercise_id: 1000,
              name: "Old Exercise",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        completedSets: { 0: { 0: true, 1: true } },
        weightAndReps: {
          0: {
            0: { weight: "50", reps: "10" },
            1: { weight: "55", reps: "8" },
          },
        },
      });
    });

    act(() => {
      // Replace with a new exercise
      useActiveWorkoutStore.getState().replaceExercise(0, {
        exercise_id: 9999,
        name: "New Exercise",
        sets: [],
      } as any);
    });

    const { workout, completedSets, weightAndReps } =
      useActiveWorkoutStore.getState();
    expect(workout?.exercises[0].exercise_id).toBe(9999);
    // The sets from the old exercise are carried over, but weightAndReps are reset to "0"
    expect(workout?.exercises[0].sets).toHaveLength(2);
    expect(completedSets[0][0]).toBe(false);
    expect(completedSets[0][1]).toBe(false);
    expect(weightAndReps[0][0]).toEqual({ weight: "0", reps: "0" });
    expect(weightAndReps[0][1]).toEqual({ weight: "0", reps: "0" });
  });

  it("deleteExercise should remove an exercise and shift data in completedSets, weightAndReps, and currentSetIndices", () => {
    act(() => {
      useActiveWorkoutStore.setState({
        workout: {
          name: "Delete Exercise Test",
          exercises: [
            {
              exercise_id: 1,
              name: "Ex 1",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
            {
              exercise_id: 2,
              name: "Ex 2",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
            {
              exercise_id: 3,
              name: "Ex 3",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        completedSets: {
          0: { 0: false },
          1: { 0: true },
          2: { 0: false },
        },
        weightAndReps: {
          0: { 0: { weight: "50", reps: "10" } },
          1: { 0: { weight: "60", reps: "8" } },
          2: { 0: { weight: "70", reps: "6" } },
        },
        currentSetIndices: {
          0: 0,
          1: 0,
          2: 0,
        },
      });
    });

    act(() => {
      // Delete the second exercise (index = 1)
      useActiveWorkoutStore.getState().deleteExercise(1);
    });

    const { workout, completedSets, weightAndReps, currentSetIndices } =
      useActiveWorkoutStore.getState();

    // Expect only 2 exercises now
    expect(workout?.exercises).toHaveLength(2);
    expect(workout?.exercises[0].exercise_id).toBe(1);
    expect(workout?.exercises[1].exercise_id).toBe(3);

    // completedSets, weightAndReps, and currentSetIndices should shift
    // so that the old index 2 becomes the new index 1
    expect(completedSets[1]).toBeDefined();
    expect(weightAndReps[1]).toBeDefined();
    expect(currentSetIndices[1]).toBeDefined();

    // The old index 1 is removed
    expect(completedSets[1][0]).toEqual(false);
    expect(weightAndReps[1][0]).toEqual({ weight: "70", reps: "6" });
  });

  it("restartWorkout should reset the workout to its originalWorkout", () => {
    const original = {
      name: "Original Workout",
      exercises: [{ exercise_id: 1, name: "Original Exercise", sets: [{}] }],
    };
    act(() => {
      useActiveWorkoutStore.setState({
        activeWorkout: { planId: 10, workoutId: 10, name: "Some Name" },
        workout: {
          name: "Modified Workout",
          exercises: [
            {
              exercise_id: 2,
              name: "Modified",
              sets: [
                {
                  repsMin: undefined,
                  repsMax: undefined,
                  restMinutes: 0,
                  restSeconds: 0,
                  time: undefined,
                },
              ],
              image: [],
              local_animated_uri: "",
              animated_url: "",
              equipment: "",
              body_part: "",
              target_muscle: "",
              secondary_muscles: [],
              description: "",
            },
          ],
        },
        originalWorkout: original as any,
      });
    });

    act(() => {
      useActiveWorkoutStore.getState().restartWorkout();
    });

    const { workout, currentExerciseIndex, completedSets, weightAndReps } =
      useActiveWorkoutStore.getState();
    expect(workout?.name).toBe("Original Workout");
    expect(workout?.exercises[0].exercise_id).toBe(1);
    expect(currentExerciseIndex).toBe(0);
    expect(completedSets).toEqual({});
    expect(weightAndReps).toEqual({});
  });

  it("startTimer and stopTimer should update timerRunning and timerExpiry", () => {
    const expiryDate = new Date(Date.now() + 1000 * 60);

    act(() => {
      useActiveWorkoutStore.getState().startTimer(expiryDate);
    });

    let { timerRunning, timerExpiry } = useActiveWorkoutStore.getState();
    expect(timerRunning).toBe(true);
    expect(timerExpiry).toEqual(expiryDate);

    act(() => {
      useActiveWorkoutStore.getState().stopTimer();
    });

    ({ timerRunning, timerExpiry } = useActiveWorkoutStore.getState());
    expect(timerRunning).toBe(false);
    expect(timerExpiry).toBeNull();
  });

  it("clearPersistedStore should reset all state fields and remove from AsyncStorage", async () => {
    // If you wish to test the AsyncStorage call, you'd mock AsyncStorage.
    // For demonstration, we'll simply ensure the store is reset.

    act(() => {
      useActiveWorkoutStore.setState({
        activeWorkout: { planId: 1, workoutId: 2, name: "Test" },
        workout: { name: "Ongoing Workout", exercises: [] },
        timerRunning: true,
        timerExpiry: new Date(),
      });

      useActiveWorkoutStore.getState().clearPersistedStore();
    });

    const {
      activeWorkout,
      workout,
      timerRunning,
      timerExpiry,
      completedSets,
      weightAndReps,
    } = useActiveWorkoutStore.getState();

    expect(activeWorkout).toBeNull();
    expect(workout).toBeNull();
    expect(timerRunning).toBe(false);
    expect(timerExpiry).toBeNull();
    expect(completedSets).toEqual({});
    expect(weightAndReps).toEqual({});
    // Optionally test that AsyncStorage.removeItem("active-workout-store") was called if you mock AsyncStorage
  });

  it("resumeWorkout should do nothing if an activeWorkout and workout don't exist", () => {
    act(() => {
      useActiveWorkoutStore.getState().resumeWorkout();
    });

    // No changes expected, just verifying it doesn't crash
    const { activeWorkout, workout } = useActiveWorkoutStore.getState();
    expect(activeWorkout).toBeNull();
    expect(workout).toBeNull();
  });
});
