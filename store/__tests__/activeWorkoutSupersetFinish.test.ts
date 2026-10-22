import { act } from "@testing-library/react-native";
import { useActiveWorkoutStore } from "../activeWorkoutStore";
import { router } from "expo-router";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: {
    notify: jest.fn(),
    leaveBreadcrumb: jest.fn(),
  },
}));

const workingSet = () => ({
  isWarmup: false,
  repsMin: 8,
  repsMax: 12,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
});

const exercise = (id: number, name: string, supersetGroupId?: string) => ({
  id,
  exercise_id: 700 + id,
  name,
  tracking_type: "weight",
  image: [],
  local_animated_uri: "",
  animated_url: "",
  equipment: "",
  body_part: "",
  target_muscle: "",
  secondary_muscles: [],
  description: "",
  supersetGroupId,
  sets: [workingSet(), workingSet()],
});

const A = exercise(1, "Bench Press", "g");
const B = exercise(2, "Barbell Row", "g");
const C = exercise(3, "Squat");
const D = exercise(4, "Curl");

// Sits on B's last set with every other superset set already done.
const seed = (
  exercises: any[],
  extraCompleted: Record<number, Record<number, boolean>> = {},
  overrides: Record<string, unknown> = {},
) => {
  useActiveWorkoutStore.setState({
    workout: { name: "Superset Workout", exercises } as any,
    currentExerciseIndex: 1,
    currentSetIndices: { 0: 1, 1: 1 },
    completedSets: {
      0: { 0: true, 1: true },
      1: { 0: true },
      ...extraCompleted,
    },
    weightAndReps: {},
    previousWorkoutData: null,
    suggestedWeightPrefills: {},
    ...overrides,
  });
};

describe("nextSet after a finished superset", () => {
  beforeEach(() => {
    useActiveWorkoutStore.setState({
      activeWorkout: null,
      workout: null,
      originalWorkout: null,
      currentExerciseIndex: 0,
      currentSetIndices: {},
      completedSets: {},
      weightAndReps: {},
      previousWorkoutData: null,
      startTime: undefined,
      timerRunning: false,
      timerExpiry: null,
      feedbackSubmittedUweIds: [],
      recoveryCheckInShown: false,
      suggestedWeightPrefills: {},
    });
    jest.clearAllMocks();
  });

  it("moves to the next unfinished exercise after the superset", () => {
    seed([A, B, C]);
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const s = useActiveWorkoutStore.getState();
    expect(s.currentExerciseIndex).toBe(2);
    expect(s.currentSetIndices[2]).toBe(0);
    expect(s.completedSets[1]).toEqual({ 0: true, 1: true });
    expect(router.back).not.toHaveBeenCalled();
  });

  it("starts the next exercise at its first unfinished set", () => {
    seed([A, B, C], { 2: { 0: true } });
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const s = useActiveWorkoutStore.getState();
    expect(s.currentExerciseIndex).toBe(2);
    expect(s.currentSetIndices[2]).toBe(1);
  });

  it("skips an exercise after the superset that is already finished", () => {
    seed([A, B, C, D], { 2: { 0: true, 1: true } });
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const s = useActiveWorkoutStore.getState();
    expect(s.currentExerciseIndex).toBe(3);
    expect(s.currentSetIndices[3]).toBe(0);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("leaves the session when nothing after the superset is unfinished", () => {
    seed([A, B, C], { 2: { 0: true, 1: true } });
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const s = useActiveWorkoutStore.getState();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(s.currentExerciseIndex).toBe(1);
    expect(s.completedSets[1][1]).toBe(true);
  });

  it("carries both halves' values into the next round", () => {
    const threeSets = (e: typeof A) => ({
      ...e,
      sets: [workingSet(), workingSet(), workingSet()],
    });
    seed(
      [threeSets(A), threeSets(B), C],
      {},
      {
        weightAndReps: {
          0: { 1: { weight: "60", reps: "10" } },
          1: { 1: { weight: "50", reps: "12" } },
        },
      },
    );
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });

    const s = useActiveWorkoutStore.getState();
    expect(s.currentExerciseIndex).toBe(0);
    expect(s.currentSetIndices).toMatchObject({ 0: 2, 1: 2 });
    expect(s.weightAndReps[0][2]?.weight).toBe("60");
    expect(s.weightAndReps[1][2]?.weight).toBe("50");
  });

  // Review Focus 5: both paths search forward only, so an unfinished
  // exercise before the one just finished is left behind and the session
  // closes. This pins that the two paths agree.
  it("behaves like the single-exercise path when an earlier exercise is unfinished", () => {
    useActiveWorkoutStore.setState({
      workout: { name: "Superset Workout", exercises: [C, A, B] } as any,
      currentExerciseIndex: 2,
      currentSetIndices: { 0: 0, 1: 1, 2: 1 },
      completedSets: { 1: { 0: true, 1: true }, 2: { 0: true } },
      weightAndReps: {},
    });
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });
    const supersetBackCalls = (router.back as jest.Mock).mock.calls.length;
    const supersetIndex = useActiveWorkoutStore.getState().currentExerciseIndex;

    jest.clearAllMocks();
    const X = exercise(5, "Plank");
    useActiveWorkoutStore.setState({
      workout: { name: "Single Workout", exercises: [C, X] } as any,
      currentExerciseIndex: 1,
      currentSetIndices: { 0: 0, 1: 1 },
      completedSets: { 1: { 0: true } },
      weightAndReps: {},
    });
    act(() => {
      useActiveWorkoutStore.getState().nextSet();
    });
    const singleBackCalls = (router.back as jest.Mock).mock.calls.length;
    const singleIndex = useActiveWorkoutStore.getState().currentExerciseIndex;

    expect(supersetBackCalls).toBe(singleBackCalls);
    expect(supersetBackCalls).toBe(1);
    expect(supersetIndex).toBe(2);
    expect(singleIndex).toBe(1);
  });
});
