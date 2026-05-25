import {
  toDisplayValue,
  toCanonicalValue,
} from "@/utils/measurementConversions";

const kg: { weightUnit: "kg" | "lbs"; sizeUnit: "cm" | "in" } = {
  weightUnit: "kg",
  sizeUnit: "cm",
};
const lbs: typeof kg = { weightUnit: "lbs", sizeUnit: "cm" };
const cm: typeof kg = { weightUnit: "kg", sizeUnit: "cm" };
const inches: typeof kg = { weightUnit: "kg", sizeUnit: "in" };

describe("toDisplayValue", () => {
  describe("mass", () => {
    it("returns kg unchanged with kg unit", () => {
      expect(toDisplayValue(80, "mass", kg)).toEqual({
        displayValue: 80,
        displayUnit: "kg",
      });
    });

    it("converts kg to lbs", () => {
      expect(toDisplayValue(80, "mass", lbs)).toEqual({
        displayValue: parseFloat((80 * 2.2046226).toFixed(1)),
        displayUnit: "lbs",
      });
    });

    it("rounds mass to 1 decimal place", () => {
      expect(toDisplayValue(72.345, "mass", kg)).toEqual({
        displayValue: 72.3,
        displayUnit: "kg",
      });
    });

    it("handles zero weight", () => {
      expect(toDisplayValue(0, "mass", kg)).toEqual({
        displayValue: 0,
        displayUnit: "kg",
      });
    });
  });

  describe("length", () => {
    it("returns cm unchanged with cm unit", () => {
      expect(toDisplayValue(90, "length", cm)).toEqual({
        displayValue: 90,
        displayUnit: "cm",
      });
    });

    it("converts cm to inches", () => {
      expect(toDisplayValue(25.4, "length", inches)).toEqual({
        displayValue: parseFloat((25.4 / 2.54).toFixed(1)),
        displayUnit: "in",
      });
    });

    it("rounds length to 1 decimal place", () => {
      expect(toDisplayValue(30.567, "length", cm)).toEqual({
        displayValue: 30.6,
        displayUnit: "cm",
      });
    });
  });

  describe("percent", () => {
    it("returns value unchanged with % unit", () => {
      expect(toDisplayValue(18.5, "percent", kg)).toEqual({
        displayValue: 18.5,
        displayUnit: "%",
      });
    });

    it("rounds percent to 1 decimal place", () => {
      expect(toDisplayValue(18.567, "percent", kg)).toEqual({
        displayValue: 18.6,
        displayUnit: "%",
      });
    });

    it("is unaffected by weightUnit or sizeUnit", () => {
      expect(toDisplayValue(20, "percent", lbs)).toEqual({
        displayValue: 20,
        displayUnit: "%",
      });
      expect(toDisplayValue(20, "percent", inches)).toEqual({
        displayValue: 20,
        displayUnit: "%",
      });
    });
  });
});

describe("toCanonicalValue", () => {
  describe("mass", () => {
    it("returns value unchanged for kg", () => {
      expect(toCanonicalValue(80, "mass", kg)).toBe(80);
    });

    it("converts lbs to kg", () => {
      expect(toCanonicalValue(176.4, "mass", lbs)).toBeCloseTo(
        176.4 * 0.45359237,
        3,
      );
    });

    it("rounds canonical mass to 4 decimal places", () => {
      const result = toCanonicalValue(100, "mass", lbs);
      expect(result).toBe(parseFloat((100 * 0.45359237).toFixed(4)));
    });
  });

  describe("length", () => {
    it("returns value unchanged for cm", () => {
      expect(toCanonicalValue(90, "length", cm)).toBe(90);
    });

    it("converts inches to cm", () => {
      expect(toCanonicalValue(10, "length", inches)).toBeCloseTo(25.4, 3);
    });

    it("rounds canonical length to 4 decimal places", () => {
      const result = toCanonicalValue(7, "length", inches);
      expect(result).toBe(parseFloat((7 * 2.54).toFixed(4)));
    });
  });

  describe("percent", () => {
    it("returns value unchanged regardless of units", () => {
      expect(toCanonicalValue(18.5, "percent", kg)).toBe(18.5);
      expect(toCanonicalValue(18.5, "percent", lbs)).toBe(18.5);
      expect(toCanonicalValue(18.5, "percent", inches)).toBe(18.5);
    });
  });
});

describe("round-trip conversions", () => {
  it("mass: display→canonical→display preserves value within rounding", () => {
    const canonical = 80;
    const { displayValue } = toDisplayValue(canonical, "mass", lbs);
    const roundTripped = toCanonicalValue(displayValue, "mass", lbs);
    // toFixed(1) on display value introduces up to 0.05 lbs; back-converted that's ~0.023 kg
    expect(Math.abs(roundTripped - canonical)).toBeLessThan(0.05);
  });

  it("length: display→canonical→display preserves value within rounding", () => {
    const canonical = 90;
    const { displayValue } = toDisplayValue(canonical, "length", inches);
    const roundTripped = toCanonicalValue(displayValue, "length", inches);
    expect(Math.abs(roundTripped - canonical)).toBeLessThan(0.1);
  });
});
