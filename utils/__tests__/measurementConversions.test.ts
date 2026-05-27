import { toDisplayValue, toCanonicalValue } from "../measurementConversions";

const KG_OPTIONS = { weightUnit: "kg" as const, sizeUnit: "cm" as const };
const LBS_OPTIONS = { weightUnit: "lbs" as const, sizeUnit: "cm" as const };
const CM_OPTIONS = { weightUnit: "kg" as const, sizeUnit: "cm" as const };
const IN_OPTIONS = { weightUnit: "kg" as const, sizeUnit: "in" as const };

describe("toDisplayValue", () => {
  describe('value_kind: "mass"', () => {
    it("returns kg value unchanged with kg unit", () => {
      expect(toDisplayValue(75, "mass", KG_OPTIONS)).toEqual({
        displayValue: 75,
        displayUnit: "kg",
      });
    });

    it("converts kg to lbs", () => {
      expect(toDisplayValue(100, "mass", LBS_OPTIONS)).toEqual({
        displayValue: 220.5,
        displayUnit: "lbs",
      });
    });

    it("rounds to 1 decimal place for lbs", () => {
      expect(toDisplayValue(1, "mass", LBS_OPTIONS)).toEqual({
        displayValue: 2.2,
        displayUnit: "lbs",
      });
    });

    it("handles zero mass", () => {
      expect(toDisplayValue(0, "mass", KG_OPTIONS)).toEqual({
        displayValue: 0,
        displayUnit: "kg",
      });
    });
  });

  describe('value_kind: "length"', () => {
    it("returns cm value unchanged with cm unit", () => {
      expect(toDisplayValue(180, "length", CM_OPTIONS)).toEqual({
        displayValue: 180,
        displayUnit: "cm",
      });
    });

    it("converts cm to inches", () => {
      expect(toDisplayValue(25.4, "length", IN_OPTIONS)).toEqual({
        displayValue: 10,
        displayUnit: "in",
      });
    });

    it("rounds to 1 decimal place for inches", () => {
      expect(toDisplayValue(100, "length", IN_OPTIONS)).toEqual({
        displayValue: 39.4,
        displayUnit: "in",
      });
    });

    it("handles zero length", () => {
      expect(toDisplayValue(0, "length", CM_OPTIONS)).toEqual({
        displayValue: 0,
        displayUnit: "cm",
      });
    });
  });

  describe('value_kind: "percent"', () => {
    it("returns percent value unchanged", () => {
      expect(toDisplayValue(18.5, "percent", KG_OPTIONS)).toEqual({
        displayValue: 18.5,
        displayUnit: "%",
      });
    });

    it("rounds to 1 decimal place", () => {
      expect(toDisplayValue(18.55, "percent", KG_OPTIONS)).toEqual({
        displayValue: 18.6,
        displayUnit: "%",
      });
    });
  });

  it("throws for unsupported value_kind", () => {
    expect(() => toDisplayValue(10, "unsupported" as any, KG_OPTIONS)).toThrow(
      "Unsupported value_kind: unsupported",
    );
  });
});

describe("toCanonicalValue", () => {
  describe('value_kind: "mass"', () => {
    it("returns kg value unchanged", () => {
      expect(toCanonicalValue(75, "mass", KG_OPTIONS)).toBe(75);
    });

    it("converts lbs to kg", () => {
      const result = toCanonicalValue(220.5, "mass", LBS_OPTIONS);
      expect(result).toBeCloseTo(100, 1);
    });

    it("converts 1 lb to kg", () => {
      const result = toCanonicalValue(1, "mass", LBS_OPTIONS);
      expect(result).toBeCloseTo(0.4536, 2);
    });
  });

  describe('value_kind: "length"', () => {
    it("returns cm value unchanged", () => {
      expect(toCanonicalValue(180, "length", CM_OPTIONS)).toBe(180);
    });

    it("converts inches to cm", () => {
      const result = toCanonicalValue(10, "length", IN_OPTIONS);
      expect(result).toBeCloseTo(25.4, 2);
    });
  });

  describe('value_kind: "percent"', () => {
    it("returns percent value unchanged", () => {
      expect(toCanonicalValue(18.5, "percent", KG_OPTIONS)).toBe(18.5);
    });
  });

  it("throws for unsupported value_kind", () => {
    expect(() =>
      toCanonicalValue(10, "unsupported" as any, KG_OPTIONS),
    ).toThrow("Unsupported value_kind: unsupported");
  });
});

describe("round-trip conversions", () => {
  it("kg → lbs → kg stays within floating-point precision", () => {
    const original = 82.5;
    const display = toDisplayValue(original, "mass", LBS_OPTIONS).displayValue;
    const roundTrip = toCanonicalValue(display, "mass", LBS_OPTIONS);
    expect(roundTrip).toBeCloseTo(original, 0); // 1 decimal tolerance
  });

  it("cm → in → cm stays within floating-point precision", () => {
    const original = 175;
    const display = toDisplayValue(original, "length", IN_OPTIONS).displayValue;
    const roundTrip = toCanonicalValue(display, "length", IN_OPTIONS);
    expect(roundTrip).toBeCloseTo(original, 0);
  });
});
