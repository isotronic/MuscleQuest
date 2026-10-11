import { useActiveWorkoutStore } from "../activeWorkoutStore";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));

const prompt = (id: number): FeedbackPrompt => ({
  userWorkoutExerciseId: id,
  exerciseName: `Exercise ${id}`,
  performanceRatio: 1,
  exerciseContext: {
    exerciseId: id,
    trackingType: "weight",
    equipment: "barbell",
    currentSets: [],
    recentWorkingWeight: 100,
  },
});

const ids = (list: FeedbackPrompt[]) =>
  list.map((p) => p.userWorkoutExerciseId);
const state = () => useActiveWorkoutStore.getState();

describe("activeWorkoutStore feedback queue", () => {
  beforeEach(() => {
    state().setWorkout(
      { id: 1, name: "Push", exercises: [] } as any,
      null,
      1,
      "Push",
    );
  });

  it("shows one card at a time: a superset's second card waits for the first", () => {
    state().queueFeedbackPrompts([prompt(1), prompt(2)]);
    // The session renders feedbackQueue[0] only.
    expect(state().feedbackQueue[0].userWorkoutExerciseId).toBe(1);

    state().recordFeedbackSubmitted(1);
    expect(ids(state().feedbackQueue)).toEqual([2]);
    expect(state().feedbackSubmittedUweIds).toEqual([1]);
  });

  it("moves an unanswered card to catch-up when the next set is completed", () => {
    state().queueFeedbackPrompts([prompt(1)]);
    // The next set's completion queues nothing new.
    state().queueFeedbackPrompts([]);

    expect(state().feedbackQueue).toEqual([]);
    expect(ids(state().feedbackCatchUp)).toEqual([1]);
  });

  it("replaces a waiting card with the next exercise's card", () => {
    state().queueFeedbackPrompts([prompt(1)]);
    state().queueFeedbackPrompts([prompt(2)]);

    expect(ids(state().feedbackQueue)).toEqual([2]);
    expect(ids(state().feedbackCatchUp)).toEqual([1]);
  });

  it("Skip moves the visible card to catch-up and shows the next", () => {
    state().queueFeedbackPrompts([prompt(1), prompt(2)]);
    state().skipFeedbackPrompt();

    expect(ids(state().feedbackQueue)).toEqual([2]);
    expect(ids(state().feedbackCatchUp)).toEqual([1]);
  });

  it("a fresh card for an exercise takes it off the catch-up list", () => {
    state().queueFeedbackPrompts([prompt(1)]);
    state().skipFeedbackPrompt();
    state().queueFeedbackPrompts([prompt(1)]);

    expect(ids(state().feedbackQueue)).toEqual([1]);
    expect(state().feedbackCatchUp).toEqual([]);
  });

  it("answering a catch-up card removes it", () => {
    state().queueFeedbackPrompts([prompt(1)]);
    state().flushFeedbackQueue();
    expect(ids(state().feedbackCatchUp)).toEqual([1]);

    state().recordFeedbackSubmitted(1);
    expect(state().feedbackCatchUp).toEqual([]);
  });

  it("a new session starts with no cards", () => {
    state().queueFeedbackPrompts([prompt(1), prompt(2)]);
    state().skipFeedbackPrompt();
    state().startQuickWorkout();

    expect(state().feedbackQueue).toEqual([]);
    expect(state().feedbackCatchUp).toEqual([]);
  });

  it("persists both lists so a restart keeps the catch-up", () => {
    state().queueFeedbackPrompts([prompt(1), prompt(2)]);
    state().skipFeedbackPrompt();
    const persisted = (useActiveWorkoutStore as any).persist
      .getOptions()
      .partialize(state());

    expect(ids(persisted.feedbackQueue)).toEqual([2]);
    expect(ids(persisted.feedbackCatchUp)).toEqual([1]);
  });
});
