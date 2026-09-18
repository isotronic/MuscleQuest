import {
  displayToKg,
  kgToDisplay,
  suggestedWeightForDisplay,
} from "@/utils/weightUnits";

describe("weightUnits", () => {
  it.each(["kg", "lbs"])("round-trips display and kg values in %s", (unit) => {
    for (const x of [0, 1, 20, 102.06, 104.3, 225, 500.5]) {
      expect(
        Math.abs(displayToKg(kgToDisplay(x, unit), unit) - x),
      ).toBeLessThan(1e-9);
      expect(
        Math.abs(kgToDisplay(displayToKg(x, unit), unit) - x),
      ).toBeLessThan(1e-9);
    }
  });

  it("leaves kg values unchanged", () => {
    expect(kgToDisplay(104.3, "kg")).toBe(104.3);
    expect(displayToKg(104.3, "kg")).toBe(104.3);
  });

  it("converts between kg and lbs", () => {
    expect(displayToKg(225, "lbs")).toBeCloseTo(102.058, 3);
    expect(kgToDisplay(102.06, "lbs")).toBeCloseTo(225.0, 1);
  });
});

describe("suggestedWeightForDisplay", () => {
  it("keeps kg suggestions at 0.1 precision", () => {
    expect(suggestedWeightForDisplay(104.34, "kg", 5)).toBe(104.3);
  });

  it("rounds pounds to the nearest plate step", () => {
    // 104.3kg is 229.94lbs.
    expect(suggestedWeightForDisplay(104.3, "lbs", 5)).toBe(230);
    expect(suggestedWeightForDisplay(104.3, "lbs", 2.5)).toBe(230);
    // 103kg is 227.08lbs.
    expect(suggestedWeightForDisplay(103, "lbs", 5)).toBe(225);
    expect(suggestedWeightForDisplay(103, "lbs", 2.5)).toBe(227.5);
  });

  it("falls back to a 0.5lb step when no plates are stocked", () => {
    expect(suggestedWeightForDisplay(104.3, "lbs", null)).toBe(230);
    expect(suggestedWeightForDisplay(103, "lbs", null)).toBe(227);
    expect(suggestedWeightForDisplay(103, "lbs", 0)).toBe(227);
  });
});
