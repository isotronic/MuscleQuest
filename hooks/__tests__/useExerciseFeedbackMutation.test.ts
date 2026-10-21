import { useExerciseFeedbackMutation } from "../useExerciseFeedbackMutation";
import {
  getProgressionSettings,
  getProgressionState,
  insertExerciseFeedback,
  upsertProgressionState,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ExerciseFeedbackPayload,
  ExerciseProgressionState,
} from "@/types/progression";

jest.mock("@/utils/database", () => ({
  insertExerciseFeedback: jest.fn(),
  getProgressionState: jest.fn(),
  getProgressionSettings: jest.fn(),
  upsertProgressionState: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

const WORKING_SET = {
  repsMin: 8,
  repsMax: 12,
  restMinutes: 2,
  restSeconds: 0,
  time: undefined,
  isWarmup: false,
};

const exerciseContext = {
  exerciseId: 100,
  trackingType: "weight",
  equipment: "barbell",
  currentSets: [WORKING_SET],
  recentWorkingWeight: 100,
};

const feedback = (
  overrides: Partial<ExerciseFeedbackPayload> = {},
): ExerciseFeedbackPayload => ({
  userWorkoutExerciseId: 42,
  effortRating: "moderate",
  painFlag: "none",
  performanceRatio: 1.0,
  ...overrides,
});

// Inputs the real engine answers with each kind of result.
const EASY = { effortRating: "easy" } as const; // increase_load
const HARD = { effortRating: "hard" } as const; // HARD_TARGET stagnation hold
const DISCOMFORT = { painFlag: "discomfort" } as const; // discomfort hold, not stagnation

const priorState = (
  overrides: Partial<ExerciseProgressionState> = {},
): ExerciseProgressionState => ({
  id: 1,
  userWorkoutExerciseId: 42,
  suggestionAction: "hold",
  ruleKey: "DEFAULT",
  ruleExplanation: "",
  consecutiveDirectionCount: 2,
  discomfortStreakCount: 1,
  consecutiveHoldCount: 1,
  plateauAdvisory: false,
  lastProgressionAt: "2026-09-01T08:00:00.000Z",
  isApplied: false,
  isDismissed: false,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("useExerciseFeedbackMutation", () => {
  let capturedArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (insertExerciseFeedback as jest.Mock).mockResolvedValue(55);
    (getProgressionState as jest.Mock).mockResolvedValue(null);
    (getProgressionSettings as jest.Mock).mockResolvedValue({
      increments: {
        barbellKg: 2.5,
        dumbbellKg: 2.0,
        cableKg: 2.5,
        machineKg: 2.5,
      },
    });
    (upsertProgressionState as jest.Mock).mockResolvedValue(undefined);
    (useQueryClient as jest.Mock).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    useExerciseFeedbackMutation();
  });

  const submit = async (
    overrides: Partial<ExerciseFeedbackPayload>,
    prior: ExerciseProgressionState | null = null,
  ) => {
    (getProgressionState as jest.Mock).mockResolvedValue(prior);
    await capturedArgs.mutationFn({
      feedback: feedback(overrides),
      exerciseContext,
    });
    const [, result, feedbackId, count, extras] = (
      upsertProgressionState as jest.Mock
    ).mock.calls[0];
    return { result, feedbackId, count, extras };
  };

  describe("consecutive direction count", () => {
    it("starts at 1 without a prior state", async () => {
      expect((await submit(EASY)).count).toBe(1);
    });

    it("grows when easy feedback follows a progression", async () => {
      const { count } = await submit(
        EASY,
        priorState({
          suggestionAction: "increase_load",
          ruleKey: "EASY_TARGET_LOAD",
        }),
      );
      expect(count).toBe(3);
    });

    it("grows when pain follows a first-failure hold", async () => {
      const { count, result } = await submit(
        { painFlag: "pain" },
        priorState({
          suggestionAction: "hold",
          ruleKey: "FAILED_FIRST_SIGNAL",
        }),
      );
      expect(count).toBe(3);
      expect(result.action).toBe("reduce_load");
    });

    it("resets on moderate feedback", async () => {
      const { count } = await submit(
        {},
        priorState({ suggestionAction: "increase_load" }),
      );
      expect(count).toBe(1);
    });

    it("resets on easy feedback with a hold intent", async () => {
      const { count } = await submit(
        { ...EASY, progressionIntent: "hold" },
        priorState({ suggestionAction: "increase_load" }),
      );
      expect(count).toBe(1);
    });
  });

  describe("discomfort streak", () => {
    it("grows on discomfort", async () => {
      const { extras } = await submit(DISCOMFORT, priorState());
      expect(extras.discomfortStreakCount).toBe(2);
    });

    it("resets on anything else", async () => {
      const { extras } = await submit(EASY, priorState());
      expect(extras.discomfortStreakCount).toBe(0);
    });
  });

  describe("hold count and last progression", () => {
    it("resets on a progression and stamps the time", async () => {
      const { result, extras } = await submit(EASY, priorState());
      expect(result.action).toBe("increase_load");
      expect(extras.consecutiveHoldCount).toBe(0);
      expect(new Date(extras.lastProgressionAt).toISOString()).toBe(
        extras.lastProgressionAt,
      );
      expect(extras.lastProgressionAt).not.toBe("2026-09-01T08:00:00.000Z");
    });

    it("grows on a stagnation hold and keeps the last progression", async () => {
      const { result, extras } = await submit(HARD, priorState());
      expect(result.ruleKey).toBe("HARD_TARGET");
      expect(extras.consecutiveHoldCount).toBe(2);
      expect(extras.lastProgressionAt).toBe("2026-09-01T08:00:00.000Z");
    });

    it("stays put on any other hold", async () => {
      const { result, extras } = await submit(DISCOMFORT, priorState());
      expect(result.ruleKey).toBe("DISCOMFORT_RECURRING");
      expect(extras.consecutiveHoldCount).toBe(1);
    });
  });

  describe("plateau advisory", () => {
    it("is off at three stagnation holds", async () => {
      const { extras } = await submit(
        HARD,
        priorState({ consecutiveHoldCount: 2 }),
      );
      expect(extras.consecutiveHoldCount).toBe(3);
      expect(extras.plateauAdvisory).toBe(false);
    });

    it("turns on at the fourth stagnation hold", async () => {
      const { extras } = await submit(
        HARD,
        priorState({ consecutiveHoldCount: 3 }),
      );
      expect(extras.consecutiveHoldCount).toBe(4);
      expect(extras.plateauAdvisory).toBe(true);
    });

    it("stays off for a non-stagnation hold at a high count", async () => {
      const { extras } = await submit(
        DISCOMFORT,
        priorState({ consecutiveHoldCount: 5 }),
      );
      expect(extras.plateauAdvisory).toBe(false);
    });
  });

  it("links the state to the saved feedback", async () => {
    expect((await submit(EASY)).feedbackId).toBe(55);
  });

  it("onSuccess refreshes that exercise's progression state", () => {
    capturedArgs.onSuccess(undefined, {
      feedback: feedback(),
      exerciseContext,
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["progressionState", 42],
    });
  });
});
