import {
  formatProgressMetric,
  formatProgressSet,
  formatOneRepMax,
} from "../exerciseProgressFormat";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));

describe("formatProgressMetric", () => {
  it("formats each tracking type in the user's units", () => {
    expect(formatProgressMetric(null, "weight", "kg", "m")).toBe("—");
    expect(formatProgressMetric(1, "reps", "kg", "m")).toBe("1 rep");
    expect(formatProgressMetric(12, "reps", "kg", "m")).toBe("12 reps");
    expect(formatProgressMetric(45, "time", "kg", "m")).toBe("0:45");
    expect(formatProgressMetric(30.48, "distance", "kg", "ft")).toBe("100 ft");
    expect(formatProgressMetric(100, "weight", "kg", "m")).toBe("100.0 kg");
  });
});

describe("formatProgressSet", () => {
  it("labels assisted sets and leaves missing values as a dash", () => {
    expect(
      formatProgressSet({ weight: 20, reps: 8 }, "assisted", "kg", "m"),
    ).toBe("20.0 kg assist × 8");
    expect(formatProgressSet({ reps: null }, "reps", "kg", "m")).toBe("—");
    expect(formatProgressSet({ time: 90 }, "time", "kg", "m")).toBe("1:30");
  });
});

describe("formatOneRepMax", () => {
  it("is null without a 1RM and labelled otherwise", () => {
    expect(formatOneRepMax(undefined, "kg")).toBeNull();
    expect(formatOneRepMax(100, "kg")).toBe("1RM 100.0 kg");
  });
});
