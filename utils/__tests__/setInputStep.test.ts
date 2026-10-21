import { stepDistance, stepReps } from "../setInputStep";

describe("stepReps", () => {
  it("adds to the current reps", () => {
    expect(stepReps("8", 1)).toBe("9");
  });

  it("starts from zero when empty", () => {
    expect(stepReps("", 1)).toBe("1");
  });

  it("never goes below zero", () => {
    expect(stepReps("0", -1)).toBe("0");
  });
});

describe("stepDistance", () => {
  it("adds to the current distance with one decimal", () => {
    expect(stepDistance("1.2", 0.5)).toBe("1.7");
  });

  it("starts from zero when empty and never goes below it", () => {
    expect(stepDistance("", -1)).toBe("0.0");
  });
});
