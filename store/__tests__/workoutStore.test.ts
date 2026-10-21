import { act } from "@testing-library/react-native";
import { useWorkoutStore, Set, UserExercise } from "../workoutStore";

let mockUuid = 0;
jest.mock("expo-crypto", () => ({
  randomUUID: () => `uuid-${++mockUuid}`,
}));

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

      // Remove the first exercise (Push-up) in workout index 0
      useWorkoutStore.getState().removeExercise(0, 0);
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

      useWorkoutStore.getState().addSetToExercise(0, 0, {
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
      useWorkoutStore.getState().updateSetInExercise(0, 0, 1, {
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
      useWorkoutStore.getState().removeSetFromExercise(0, 0, 0);
    });

    const { workouts } = useWorkoutStore.getState();
    expect(workouts[0].exercises[0].sets).toHaveLength(1);
    expect(workouts[0].exercises[0].sets[0].repsMin).toBe(10); // The second set remains
  });

  describe("the same exercise twice", () => {
    const squat = (reps: number) => ({
      exercise_id: 200,
      name: "Squat",
      image: [],
      local_animated_uri: "",
      animated_url: "",
      equipment: "barbell",
      body_part: "legs",
      target_muscle: "quads",
      secondary_muscles: [],
      description: "",
      sets: [
        {
          repsMin: reps,
          repsMax: reps,
          restMinutes: 2,
          restSeconds: 0,
          time: undefined,
        },
      ],
    });

    beforeEach(() => {
      act(() => {
        useWorkoutStore.setState({
          workouts: [{ id: 1, name: "Legs", exercises: [squat(3), squat(8)] }],
        });
      });
    });

    it("edits only the block it is given", () => {
      act(() => {
        useWorkoutStore.getState().addSetToExercise(0, 1, {
          repsMin: 10,
          repsMax: 10,
          restMinutes: 1,
          restSeconds: 0,
          time: undefined,
        });
      });
      const [heavy, backOff] = useWorkoutStore.getState().workouts[0].exercises;
      expect(heavy.sets).toHaveLength(1);
      expect(backOff.sets.map((s) => s.repsMin)).toEqual([8, 10]);
    });

    it("gives each added block its own row key", () => {
      act(() => {
        useWorkoutStore.getState().addExercise(0, squat(5));
        useWorkoutStore.getState().addExercise(0, squat(5));
      });
      const keys = useWorkoutStore
        .getState()
        .workouts[0].exercises.slice(2)
        .map((e) => e.clientKey);
      expect(keys[0]).toBeTruthy();
      expect(keys[0]).not.toBe(keys[1]);
    });

    it("removes only the block it is given", () => {
      act(() => {
        useWorkoutStore.getState().removeExercise(0, 1);
      });
      const { exercises } = useWorkoutStore.getState().workouts[0];
      expect(exercises.map((e) => e.sets[0].repsMin)).toEqual([3]);
    });
  });

  describe("reorderWorkouts", () => {
    const seedThree = () => {
      act(() => {
        useWorkoutStore.setState({
          workouts: [
            { id: 1, name: "W0", exercises: [] },
            { id: 2, name: "W1", exercises: [] },
            { id: 3, name: "W2", exercises: [] },
          ],
          planSchedule: { 1: 0, 3: 1, 5: 2 },
        });
      });
    };

    it("moves a workout forward and remaps the schedule", () => {
      seedThree();
      act(() => useWorkoutStore.getState().reorderWorkouts(0, 2));
      const { workouts, planSchedule } = useWorkoutStore.getState();
      expect(workouts.map((w) => w.name)).toEqual(["W1", "W2", "W0"]);
      expect(planSchedule).toEqual({ 1: 2, 3: 0, 5: 1 });
    });

    it("moves a workout backward and remaps the schedule", () => {
      seedThree();
      act(() => useWorkoutStore.getState().reorderWorkouts(2, 0));
      const { workouts, planSchedule } = useWorkoutStore.getState();
      expect(workouts.map((w) => w.name)).toEqual(["W2", "W0", "W1"]);
      expect(planSchedule).toEqual({ 1: 1, 3: 2, 5: 0 });
    });

    it.each([
      [1, 1],
      [-1, 0],
      [0, 3],
    ])("ignores the move (%i, %i)", (from, to) => {
      seedThree();
      const before = useWorkoutStore.getState().workouts;
      act(() => useWorkoutStore.getState().reorderWorkouts(from, to));
      expect(useWorkoutStore.getState().workouts).toBe(before);
    });
  });

  describe("schedule", () => {
    const seedSchedule = () => {
      act(() => {
        useWorkoutStore.setState({
          workouts: [
            { id: 1, name: "W0", exercises: [] },
            { id: 2, name: "W1", exercises: [] },
            { id: 3, name: "W2", exercises: [] },
          ],
          planSchedule: { 1: 0, 3: 1, 5: 2 },
        });
      });
    };

    it("removeWorkout drops its days and shifts later indices", () => {
      seedSchedule();
      act(() => useWorkoutStore.getState().removeWorkout(1));
      expect(useWorkoutStore.getState().planSchedule).toEqual({ 1: 0, 5: 1 });
    });

    it("syncScheduleOnRemoveWorkout drops its days and shifts later indices", () => {
      seedSchedule();
      act(() => useWorkoutStore.getState().syncScheduleOnRemoveWorkout(1));
      expect(useWorkoutStore.getState().planSchedule).toEqual({ 1: 0, 5: 1 });
    });

    it("setPlanSchedule keeps only valid days and workout indices", () => {
      act(() => {
        useWorkoutStore.setState({
          workouts: [
            { id: 1, name: "W0", exercises: [] },
            { id: 2, name: "W1", exercises: [] },
          ],
        });
        useWorkoutStore
          .getState()
          .setPlanSchedule({ 0: 0, 6: 1, 7: 0, [-1]: 0, 2: 2, 3: 1.5 });
      });
      expect(useWorkoutStore.getState().planSchedule).toEqual({ 0: 0, 6: 1 });
    });
  });

  const set = (repsMin: number, extra: Partial<Set> = {}): Set => ({
    repsMin,
    repsMax: repsMin,
    restMinutes: 1,
    restSeconds: 0,
    time: undefined,
    ...extra,
  });

  const ex = (
    name: string,
    sets: Set[],
    extra: Partial<UserExercise> = {},
  ): UserExercise => ({
    exercise_id: name.length,
    name,
    image: [],
    local_animated_uri: "",
    animated_url: "",
    equipment: "",
    body_part: "",
    target_muscle: "",
    secondary_muscles: [],
    description: "",
    tracking_type: "weight",
    sets,
    ...extra,
  });

  const seedWorkout = (exercises: UserExercise[]) => {
    act(() => {
      useWorkoutStore.setState({
        workouts: [{ id: 1, name: "Day", exercises }],
      });
    });
  };

  const exercisesNow = () => useWorkoutStore.getState().workouts[0].exercises;

  describe("replaceExercise", () => {
    const oldSets = [set(5), set(6)];
    const defaultSets = [set(10)];
    const defaultTimeSets = [set(0, { time: 30 })];

    it.each([
      ["weight", "weight", "old"],
      ["weight", "assisted", "old"],
      ["assisted", "weight", "old"],
      ["", "weight", "old"],
      ["weight", "time", "time"],
      ["time", "weight", "default"],
    ])("%s to %s keeps the %s sets", (from, to, expected) => {
      seedWorkout([ex("Old", oldSets, { tracking_type: from })]);
      act(() =>
        useWorkoutStore
          .getState()
          .replaceExercise(
            0,
            0,
            ex("New", [], { tracking_type: to }),
            defaultSets,
            defaultTimeSets,
          ),
      );
      const expectedSets =
        expected === "old"
          ? oldSets
          : expected === "time"
            ? defaultTimeSets
            : defaultSets;
      expect(exercisesNow()[0].sets).toEqual(expectedSets);
    });

    it("gives the replaced row a new clientKey", () => {
      seedWorkout([ex("Old", oldSets, { clientKey: "old-key" })]);
      act(() =>
        useWorkoutStore
          .getState()
          .replaceExercise(0, 0, ex("New", []), defaultSets, defaultTimeSets),
      );
      const { clientKey } = exercisesNow()[0];
      expect(clientKey).toBeTruthy();
      expect(clientKey).not.toBe("old-key");
    });

    it("keeps the superset group of the row it replaces", () => {
      seedWorkout([
        ex("A", oldSets, { supersetGroupId: "g" }),
        ex("B", oldSets, { supersetGroupId: "g" }),
      ]);
      act(() =>
        useWorkoutStore
          .getState()
          .replaceExercise(0, 1, ex("New", []), defaultSets, defaultTimeSets),
      );
      expect(exercisesNow()[1].supersetGroupId).toBe("g");
    });
  });

  describe("superset halves keep equal set counts", () => {
    it("createSuperset pads the new partner to the exercise's set count", () => {
      seedWorkout([ex("A", [set(1), set(2), set(3)])]);
      act(() =>
        useWorkoutStore
          .getState()
          .createSuperset(0, 0, ex("X", [set(9), set(8)])),
      );
      const [, x] = exercisesNow();
      expect(x.sets.map((s) => s.repsMin)).toEqual([9, 8, 8]);
    });

    it("createSuperset trims the new partner to the exercise's set count", () => {
      seedWorkout([ex("A", [set(1)])]);
      act(() =>
        useWorkoutStore
          .getState()
          .createSuperset(0, 0, ex("X", [set(9), set(8), set(7)])),
      );
      expect(exercisesNow()[1].sets.map((s) => s.repsMin)).toEqual([9]);
    });

    it("replaceExercise matches the partner's set count when sets reset", () => {
      seedWorkout([
        ex("A", [set(1), set(2)], { supersetGroupId: "g" }),
        ex("B", [set(3), set(4)], { supersetGroupId: "g" }),
      ]);
      const timeSets = [
        set(0, { time: 30 }),
        set(0, { time: 30 }),
        set(0, { time: 30 }),
      ];
      act(() =>
        useWorkoutStore
          .getState()
          .replaceExercise(
            0,
            1,
            ex("Plank", [], { tracking_type: "time" }),
            [set(10)],
            timeSets,
          ),
      );
      expect(exercisesNow()[1].sets).toHaveLength(2);
    });
  });

  describe("insertSetAtExercise", () => {
    it("mirrors the insert to the superset partner with the new set's flags", () => {
      seedWorkout([
        ex("A", [set(1), set(2)], { supersetGroupId: "g" }),
        ex("B", [set(3), set(4)], { supersetGroupId: "g" }),
      ]);
      const inserted = set(9, { isWarmup: true });
      act(() =>
        useWorkoutStore.getState().insertSetAtExercise(0, 0, 1, inserted),
      );
      const [a, b] = exercisesNow();
      expect(a.sets).toHaveLength(3);
      expect(b.sets).toHaveLength(3);
      expect(a.sets[1]).toEqual(inserted);
      expect(b.sets[1]).toEqual({
        ...set(4),
        isWarmup: true,
        isDropSet: undefined,
        isToFailure: undefined,
      });
    });

    it("ignores an exercise index that does not exist", () => {
      seedWorkout([ex("A", [set(1)])]);
      const before = useWorkoutStore.getState().workouts;
      act(() =>
        useWorkoutStore.getState().insertSetAtExercise(0, 5, 0, set(2)),
      );
      expect(useWorkoutStore.getState().workouts).toBe(before);
    });
  });

  describe("removeSetFromExercise", () => {
    it("removes the same set from the superset partner", () => {
      seedWorkout([
        ex("A", [set(1), set(2), set(3)], { supersetGroupId: "g" }),
        ex("B", [set(4), set(5), set(6)], { supersetGroupId: "g" }),
      ]);
      act(() => useWorkoutStore.getState().removeSetFromExercise(0, 0, 1));
      const [a, b] = exercisesNow();
      expect(a.sets.map((s) => s.repsMin)).toEqual([1, 3]);
      expect(b.sets.map((s) => s.repsMin)).toEqual([4, 6]);
    });

    it("keeps the last set of a single exercise", () => {
      seedWorkout([ex("A", [set(1)])]);
      act(() => useWorkoutStore.getState().removeSetFromExercise(0, 0, 0));
      expect(exercisesNow()[0].sets).toHaveLength(1);
    });

    // Review Focus 1, the shape that converges: the keep-last-set guard leaves
    // A alone, so 1 and 2 sets end at 1 and 1. Halves that start uneven
    // (createSuperset adds the partner with default sets) are never evened
    // out; that is a separate open question, not pinned here.
    it("ends with equal halves when the single-set side keeps its last set", () => {
      seedWorkout([
        ex("A", [set(1)], { supersetGroupId: "g" }),
        ex("B", [set(2), set(3)], { supersetGroupId: "g" }),
      ]);
      act(() => useWorkoutStore.getState().removeSetFromExercise(0, 1, 0));
      const [a, b] = exercisesNow();
      expect(a.sets.length).toBe(b.sets.length);
    });
  });

  describe("updateSetInExercise", () => {
    it("changes only the targeted set and does not mirror to the partner", () => {
      seedWorkout([
        ex("A", [set(1), set(2)], { supersetGroupId: "g" }),
        ex("B", [set(3), set(4)], { supersetGroupId: "g" }),
      ]);
      act(() =>
        useWorkoutStore.getState().updateSetInExercise(0, 0, 1, set(20)),
      );
      const [a, b] = exercisesNow();
      expect(a.sets.map((s) => s.repsMin)).toEqual([1, 20]);
      expect(b.sets.map((s) => s.repsMin)).toEqual([3, 4]);
    });
  });

  describe("setExerciseTrackingTypeOverride", () => {
    it("sets the override", () => {
      seedWorkout([ex("Pull-up", [set(1)], { tracking_type: "reps" })]);
      act(() =>
        useWorkoutStore
          .getState()
          .setExerciseTrackingTypeOverride(0, 0, "weight"),
      );
      expect(exercisesNow()[0].tracking_type_override).toBe("weight");
    });

    it("removes the key when cleared", () => {
      seedWorkout([
        ex("Pull-up", [set(1)], {
          tracking_type: "reps",
          tracking_type_override: "weight",
        }),
      ]);
      act(() =>
        useWorkoutStore
          .getState()
          .setExerciseTrackingTypeOverride(0, 0, undefined),
      );
      expect("tracking_type_override" in exercisesNow()[0]).toBe(false);
    });
  });

  describe("supersets", () => {
    it("createSuperset inserts the partner after the exercise with a shared group", () => {
      seedWorkout([ex("A", [set(1)]), ex("C", [set(2)])]);
      act(() =>
        useWorkoutStore.getState().createSuperset(0, 0, ex("X", [set(3)])),
      );
      const [a, x, c] = exercisesNow();
      expect([a.name, x.name, c.name]).toEqual(["A", "X", "C"]);
      expect(a.supersetGroupId).toBeTruthy();
      expect(x.supersetGroupId).toBe(a.supersetGroupId);
      expect(c.supersetGroupId).toBeUndefined();
      expect(x.clientKey).toBeTruthy();
    });

    it("removeFromSuperset clears the group from both halves only", () => {
      seedWorkout([
        ex("A", [set(1)], { supersetGroupId: "g" }),
        ex("B", [set(2)], { supersetGroupId: "g" }),
        ex("C", [set(3)], { supersetGroupId: "h" }),
        ex("D", [set(4)], { supersetGroupId: "h" }),
      ]);
      act(() => useWorkoutStore.getState().removeFromSuperset(0, 1));
      const exercises = exercisesNow();
      expect("supersetGroupId" in exercises[0]).toBe(false);
      expect("supersetGroupId" in exercises[1]).toBe(false);
      expect(exercises[2].supersetGroupId).toBe("h");
      expect(exercises[3].supersetGroupId).toBe("h");
    });
  });

  describe("persisted draft migration", () => {
    const migrate = useWorkoutStore.persist.getOptions().migrate!;

    it("drops drafts saved before version 1", () => {
      expect(migrate({ anything: 1 }, 0)).toEqual({ drafts: {} });
    });

    it("keeps version 1 drafts as they are", () => {
      const persisted = {
        drafts: { "edit:3": { workouts: [], draftName: "Push" } },
      };
      expect(migrate(persisted, 1)).toBe(persisted);
    });
  });
});
