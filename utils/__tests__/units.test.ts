import {
  CM_PER_IN,
  KG_PER_LB,
  M_PER_FT,
  cmToDisplay,
  displayToCm,
  displayToKg,
  displayToMetres,
  formatWeight,
  isAtLeast,
  kgToDisplay,
  metresToDisplay,
  nearlyEqual,
  roundCanonical,
} from "@/utils/units";

// 0 to max in fixed steps, built from integers so the inputs carry no float
// noise of their own.
const range = (max: number, step: number): number[] =>
  Array.from({ length: Math.round(max / step) + 1 }, (_, i) =>
    parseFloat((i * step).toFixed(2)),
  );

describe("weight", () => {
  it.each(["kg", "lbs"])(
    "round-trips every 0.5 step from 0 to 500 %s through storage",
    (unit) => {
      for (const w of range(500, 0.5)) {
        const stored = roundCanonical(displayToKg(w, unit));
        expect(kgToDisplay(stored, unit).toFixed(1)).toBe(w.toFixed(1));
      }
    },
  );

  it("stores 225 lbs as the same value every time", () => {
    const first = roundCanonical(displayToKg(225, "lbs"));
    const second = roundCanonical(displayToKg(225, "lbs"));
    expect(first).toBe(102.058);
    expect(second).toBe(first);
  });

  it("leaves kg values unchanged", () => {
    expect(kgToDisplay(104.3, "kg")).toBe(104.3);
    expect(displayToKg(104.3, "kg")).toBe(104.3);
  });

  it("uses the exact pound definition", () => {
    expect(displayToKg(1, "lbs")).toBe(KG_PER_LB);
    expect(kgToDisplay(KG_PER_LB, "lbs")).toBe(1);
  });

  it("formats converted weights without the unit label", () => {
    expect(formatWeight(102.058, "lbs")).toBe("225.0");
    expect(formatWeight(102.058, "kg")).toBe("102.1");
    expect(formatWeight(102.058, "kg", { decimals: 2 })).toBe("102.06");
  });
});

describe("distance", () => {
  it.each(["m", "ft"])(
    "round-trips every 0.25 step from 0 to 1000 %s through storage",
    (unit) => {
      for (const d of range(1000, 0.25)) {
        const stored = roundCanonical(displayToMetres(d, unit));
        expect(metresToDisplay(stored, unit).toFixed(2)).toBe(d.toFixed(2));
      }
    },
  );

  it("uses the exact foot definition", () => {
    expect(displayToMetres(1, "ft")).toBe(M_PER_FT);
    expect(metresToDisplay(M_PER_FT, "ft")).toBe(1);
  });
});

describe("length", () => {
  it.each(["cm", "in"])(
    "round-trips every 0.1 step from 0 to 200 %s through storage",
    (unit) => {
      for (const l of range(200, 0.1)) {
        const stored = roundCanonical(displayToCm(l, unit));
        expect(cmToDisplay(stored, unit).toFixed(1)).toBe(l.toFixed(1));
      }
    },
  );

  it("uses the exact inch definition", () => {
    expect(displayToCm(1, "in")).toBe(CM_PER_IN);
    expect(cmToDisplay(CM_PER_IN, "in")).toBe(1);
  });
});

describe("roundCanonical", () => {
  it("rounds to three decimals", () => {
    expect(roundCanonical(102.05820832500001)).toBe(102.058);
    expect(roundCanonical(61.2349699)).toBe(61.235);
    expect(roundCanonical(0)).toBe(0);
  });
});

describe("metric comparisons", () => {
  // 225 lbs saved before rounding, and the same lift saved after.
  const legacy = 225 * KG_PER_LB;
  const rounded = roundCanonical(legacy);
  // 135 lbs rounds up, so the new row is the larger of the two.
  const legacyUp = 135 * KG_PER_LB;
  const roundedUp = roundCanonical(legacyUp);

  it("treats a legacy row and a rounded row of the same lift as equal", () => {
    expect(nearlyEqual(legacy, rounded)).toBe(true);
    expect(nearlyEqual(legacyUp, roundedUp)).toBe(true);
    expect(isAtLeast(rounded, legacy)).toBe(true);
    expect(isAtLeast(legacyUp, roundedUp)).toBe(true);
  });

  it("holds for a paired, high-rep 1RM where rounding error is scaled up", () => {
    const oneRm = (kg: number) => kg * 2 * (1 + 30 / 30);
    expect(isAtLeast(oneRm(legacyUp), oneRm(roundedUp))).toBe(true);
    expect(isAtLeast(oneRm(rounded), oneRm(legacy))).toBe(true);
  });

  it("still separates the smallest real improvement", () => {
    const halfPoundMore = roundCanonical(225.5 * KG_PER_LB);
    expect(nearlyEqual(halfPoundMore, rounded)).toBe(false);
    expect(isAtLeast(rounded, halfPoundMore)).toBe(false);
  });
});
