import { act } from "@testing-library/react-native";
import { useWorkoutStore } from "../workoutStore";

describe("useWorkoutStore", () => {
  // Reset the store to a clean initial state before each test
  beforeEach(() => {
    useWorkoutStore.setState({
      workouts: [],
      newExerciseId: null,
      planImageUrl:
        "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    });
  });

  it("should have the correct initial state", () => {
    const state = useWorkoutStore.getState();
    expect(state.workouts).toEqual([]);
    expect(state.newExerciseId).toBeNull();
    expect(state.planImageUrl).toContain("images.unsplash");
  });

  it("setNewExerciseId should update the store correctly", () => {
    act(() => {
      useWorkoutStore.getState().setNewExerciseId(42);
    });
    const { newExerciseId } = useWorkoutStore.getState();
    expect(newExerciseId).toBe(42);
  });

  it("setPlanImageUrl should update planImageUrl in the store", () => {
    const newUrl = "https://example.com/some-image.jpg";
    act(() => {
      useWorkoutStore.getState().setPlanImageUrl(newUrl);
    });
    const { planImageUrl } = useWorkoutStore.getState();
    expect(planImageUrl).toBe(newUrl);
  });

  it("setWorkouts should replace the entire workouts array", () => {
    const mockWorkout = { id: 1, name: "Test Workout", exercises: [] };
    act(() => {
      useWorkoutStore.getState().setWorkouts([mockWorkout]);
    });
    const { workouts } = useWorkoutStore.getState();
    expect(workouts).toHaveLength(1);
    expect(workouts[0].name).toBe("Test Workout");
  });

  it("clearWorkouts should reset workouts to an empty array", () => {
    act(() => {
      useWorkoutStore
        .getState()
        .setWorkouts([{ id: 1, name: "Workout A", exercises: [] }]);
      useWorkoutStore.getState().clearWorkouts();
    });
    const { workouts } = useWorkoutStore.getState();
    expect(workouts).toHaveLength(0);
  });

  it("addWorkout should append a workout to the existing array", () => {
    const mockWorkoutA = { id: 1, name: "Workout A", exercises: [] };
    const mockWorkoutB = { id: 2, name: "Workout B", exercises: [] };

    act(() => {
      useWorkoutStore.getState().addWorkout(mockWorkoutA);
      useWorkoutStore.getState().addWorkout(mockWorkoutB);
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts).toHaveLength(2);
    expect(workouts[0].name).toBe("Workout A");
    expect(workouts[1].name).toBe("Workout B");
  });

  it("changeWorkoutName should update the correct workout's name", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          { id: 1, name: "Old Name", exercises: [] },
          { id: 2, name: "Another Workout", exercises: [] },
        ],
      });

      useWorkoutStore.getState().changeWorkoutName(0, "New Name");
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].name).toBe("New Name");
    expect(workouts[1].name).toBe("Another Workout");
  });

  it("addExercise should add an exercise to the specified workout", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Workout with Exercises",
            exercises: [],
          },
        ],
      });

      useWorkoutStore.getState().addExercise(0, {
        exercise_id: 101,
        name: "Push-up",
        image: [],
        local_animated_uri: "",
        animated_url: "",
        equipment: "none",
        body_part: "chest",
        target_muscle: "pecs",
        secondary_muscles: [],
        description: "A basic push-up",
        sets: [],
      });
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].exercises).toHaveLength(1);
    expect(workouts[0].exercises[0].name).toBe("Push-up");
  });

  it("removeWorkout should remove the correct workout from the store", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          { id: 1, name: "Workout A", exercises: [] },
          { id: 2, name: "Workout B", exercises: [] },
        ],
      });

      // Remove the first workout (index 0)
      useWorkoutStore.getState().removeWorkout(0);
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts).toHaveLength(1);
    // Should now only contain the second workout
    expect(workouts[0].name).toBe("Workout B");
  });

  it("removeExercise should remove the correct exercise from a workout", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Workout A",
            exercises: [
              {
                exercise_id: 100,
                name: "Push-up",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "none",
                body_part: "chest",
                target_muscle: "pecs",
                secondary_muscles: [],
                description: "A basic push-up",
                sets: [],
              },
              {
                exercise_id: 200,
                name: "Squat",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "none",
                body_part: "legs",
                target_muscle: "quads",
                secondary_muscles: [],
                description: "A basic squat",
                sets: [],
              },
            ],
          },
        ],
      });

      // Remove exercise with exercise_id = 100 in workout index 0
      useWorkoutStore.getState().removeExercise(0, 100);
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].exercises).toHaveLength(1);
    expect(workouts[0].exercises[0].exercise_id).toBe(200); // The Squat remains
  });

  it("replaceExercise should replace an exercise and handle sets based on tracking type", () => {
    // Some default sets you might want to swap in
    const defaultSets = [
      {
        repsMin: 8,
        repsMax: 10,
        restMinutes: 1,
        restSeconds: 30,
        time: undefined,
      },
    ];
    const defaultTimeSets = [
      {
        repsMin: undefined,
        repsMax: undefined,
        restMinutes: 0,
        restSeconds: 30,
        time: 30,
      },
    ];

    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Mixed Workout",
            exercises: [
              {
                exercise_id: 300,
                name: "Bench Press",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "barbell",
                body_part: "chest",
                target_muscle: "pecs",
                secondary_muscles: [],
                description: "A bench press exercise",
                tracking_type: "weight",
                sets: [
                  {
                    repsMin: 10,
                    repsMax: 12,
                    restMinutes: 1,
                    restSeconds: 30,
                    time: undefined,
                  },
                ],
              },
            ],
          },
        ],
      });

      // Replace old weight-based exercise with a time-based exercise
      useWorkoutStore.getState().replaceExercise(
        0, // workoutIndex
        0, // exerciseIndex
        {
          exercise_id: 301,
          name: "Plank",
          image: [],
          local_animated_uri: "",
          animated_url: "",
          equipment: "bodyweight",
          body_part: "core",
          target_muscle: "abs",
          secondary_muscles: [],
          description: "Plank exercise",
          tracking_type: "time",
          sets: [], // We'll see what replaceExercise does with sets
        },
        defaultSets,
        defaultTimeSets,
      );
    });

    const { workouts } = useWorkoutStore.getState();
    const replacedExercise = workouts[0].exercises[0];
    expect(replacedExercise.exercise_id).toBe(301);
    // Since old tracking was "weight" and new tracking is "time",
    // replaceExercise should set the defaultTimeSets
    expect(replacedExercise.sets).toEqual(defaultTimeSets);
  });

  it("addSetToExercise should add a set to the correct exercise in the correct workout", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Workout with a single exercise",
            exercises: [
              {
                exercise_id: 400,
                name: "Pull-up",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "bar",
                body_part: "back",
                target_muscle: "lats",
                secondary_muscles: [],
                description: "A pull-up",
                tracking_type: "weight",
                sets: [],
              },
            ],
          },
        ],
      });

      useWorkoutStore.getState().addSetToExercise(0, 400, {
        repsMin: 5,
        repsMax: 8,
        restMinutes: 1,
        restSeconds: 0,
        time: undefined,
      });
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].exercises[0].sets).toHaveLength(1);
    expect(workouts[0].exercises[0].sets[0].repsMin).toBe(5);
  });

  it("updateSetInExercise should update the specified set in the correct exercise", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Workout with multiple sets",
            exercises: [
              {
                exercise_id: 500,
                name: "Deadlift",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "barbell",
                body_part: "back",
                target_muscle: "back",
                secondary_muscles: [],
                description: "A deadlift",
                tracking_type: "weight",
                sets: [
                  {
                    repsMin: 5,
                    repsMax: 6,
                    restMinutes: 2,
                    restSeconds: 0,
                    time: undefined,
                  },
                  {
                    repsMin: 3,
                    repsMax: 5,
                    restMinutes: 2,
                    restSeconds: 30,
                    time: undefined,
                  },
                ],
              },
            ],
          },
        ],
      });

      // Update the second set (index 1)
      useWorkoutStore.getState().updateSetInExercise(0, 500, 1, {
        repsMin: 4,
        repsMax: 6,
        restMinutes: 3,
        restSeconds: 0,
        time: undefined,
      });
    });

    const { workouts } = useWorkoutStore.getState();
    const updatedSet = workouts[0].exercises[0].sets[1];
    expect(updatedSet.repsMin).toBe(4);
    expect(updatedSet.repsMax).toBe(6);
    expect(updatedSet.restMinutes).toBe(3);
  });

  it("removeSetFromExercise should remove the specified set from the correct exercise", () => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [
          {
            id: 1,
            name: "Workout for set removal",
            exercises: [
              {
                exercise_id: 600,
                name: "Shoulder Press",
                image: [],
                local_animated_uri: "",
                animated_url: "",
                equipment: "dumbbell",
                body_part: "shoulders",
                target_muscle: "deltoids",
                secondary_muscles: [],
                description: "A shoulder press",
                tracking_type: "weight",
                sets: [
                  {
                    repsMin: 8,
                    repsMax: 10,
                    restMinutes: 1,
                    restSeconds: 30,
                    time: undefined,
                  },
                  {
                    repsMin: 10,
                    repsMax: 12,
                    restMinutes: 2,
                    restSeconds: 0,
                    time: undefined,
                  },
                ],
              },
            ],
          },
        ],
      });

      // Remove the first set (index 0)
      useWorkoutStore.getState().removeSetFromExercise(0, 600, 0);
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].exercises[0].sets).toHaveLength(1);
    expect(workouts[0].exercises[0].sets[0].repsMin).toBe(10); // The second set remains
  });
});
