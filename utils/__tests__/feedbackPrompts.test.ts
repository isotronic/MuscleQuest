import {
  buildFeedbackPayload,
  isBelowTarget,
  mergePrompts,
  withoutExercise,
  type FeedbackPrompt,
} from "@/utils/feedbackPrompts";

const prompt = (id: number, performanceRatio = 1.0): FeedbackPrompt => ({
  userWorkoutExerciseId: id,
  exerciseName: `Exercise ${id}`,
  performanceRatio,
  exerciseContext: {
    exerciseId: id * 10,
    trackingType: "weight",
    equipment: "barbell",
    currentSets: [],
    recentWorkingWeight: 100,
  },
});

describe("buildFeedbackPayload", () => {
  it("sends effort with no pain by default", () => {
    expect(
      buildFeedbackPayload(prompt(1, 1.1), { effort: "easy", pain: "none" }),
    ).toEqual({
      userWorkoutExerciseId: 1,
      effortRating: "easy",
      painFlag: "none",
      progressionIntent: undefined,
      performanceRatio: 1.1,
      notes: undefined,
    });
  });

  it("sends Stay here only with About right", () => {
    const choice = { pain: "none" as const, intent: "hold" as const };
    expect(
      buildFeedbackPayload(prompt(1), { ...choice, effort: "moderate" })
        .progressionIntent,
    ).toBe("hold");
    expect(
      buildFeedbackPayload(prompt(1), { ...choice, effort: "easy" })
        .progressionIntent,
    ).toBeUndefined();
  });

  it("keeps a note only when pain was reported", () => {
    expect(
      buildFeedbackPayload(prompt(1), {
        effort: "hard",
        pain: "pain",
        notes: "  left shoulder ",
      }).notes,
    ).toBe("left shoulder");
    expect(
      buildFeedbackPayload(prompt(1), {
        effort: "hard",
        pain: "discomfort",
        notes: "left shoulder",
      }).notes,
    ).toBeUndefined();
  });
});

describe("isBelowTarget", () => {
  it("is below target under a ratio of 1", () => {
    expect(isBelowTarget(0.99)).toBe(true);
    expect(isBelowTarget(1)).toBe(false);
  });
});

describe("mergePrompts", () => {
  it("keeps one prompt per exercise, the newer in the older one's place", () => {
    const newer = { ...prompt(1), performanceRatio: 0.5 };
    expect(mergePrompts([prompt(1), prompt(2)], [newer, prompt(3)])).toEqual([
      newer,
      prompt(2),
      prompt(3),
    ]);
  });

  it("withoutExercise drops that exercise only", () => {
    expect(withoutExercise([prompt(1), prompt(2)], 1)).toEqual([prompt(2)]);
  });
});
