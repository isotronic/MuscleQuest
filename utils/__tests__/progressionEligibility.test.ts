import { sessionSupportsProgression } from "@/utils/progressionEligibility";

describe("sessionSupportsProgression", () => {
  it("allows a plan workout", () => {
    expect(
      sessionSupportsProgression({ workoutId: 4, isQuickWorkout: false }),
    ).toBe(true);
  });

  it("allows a saved workout outside a plan", () => {
    // planId is not an input: a standalone workout has a workout id only.
    expect(
      sessionSupportsProgression({ workoutId: 9, isQuickWorkout: false }),
    ).toBe(true);
  });

  it("excludes a quick workout", () => {
    expect(
      sessionSupportsProgression({ workoutId: null, isQuickWorkout: true }),
    ).toBe(false);
  });

  it("excludes a quick workout even once it has an id", () => {
    expect(
      sessionSupportsProgression({ workoutId: 12, isQuickWorkout: true }),
    ).toBe(false);
  });
});
