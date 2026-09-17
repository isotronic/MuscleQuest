import { computeSteppedWeight } from "../weightStep";

describe("computeSteppedWeight", () => {
  it("preserves 2 decimal places when stepping from a precise base weight", () => {
    expect(computeSteppedWeight("62.25", 2.5)).toBe("64.75");
  });

  it("adds the increment to a whole-number base weight", () => {
    expect(computeSteppedWeight("60", 2.5)).toBe("62.5");
  });

  it("never goes below 0", () => {
    expect(computeSteppedWeight("1", -2.5)).toBe("0");
  });

  it("treats a non-numeric base weight as 0", () => {
    expect(computeSteppedWeight("", 2.5)).toBe("2.5");
  });

  it("guards against floating-point artifacts", () => {
    expect(computeSteppedWeight("61.3", 2.3)).toBe("63.6");
  });
});
