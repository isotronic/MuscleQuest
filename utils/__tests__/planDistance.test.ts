import { planDistanceRange, planDistanceToDisplay } from "../planDistance";

describe("planDistanceToDisplay", () => {
  it("converts stored metres to feet, to two decimals", () => {
    expect(planDistanceToDisplay(400, "ft")).toBe(1312.34);
  });

  it("leaves metres unchanged", () => {
    expect(planDistanceToDisplay(400, "m")).toBe(400);
  });
});

describe("planDistanceRange", () => {
  it("shows one value when every set has the same target", () => {
    expect(planDistanceRange([{ distance: 400 }, { distance: 400 }], "m")).toBe(
      "400",
    );
  });

  it("shows the smallest to largest target in the user's unit", () => {
    expect(
      planDistanceRange([{ distance: 304.8 }, { distance: 609.6 }], "ft"),
    ).toBe("1000 - 2000");
  });

  it("ignores sets without a target", () => {
    expect(
      planDistanceRange([{ distance: undefined }, { distance: 100 }], "m"),
    ).toBe("100");
  });

  it("is undefined when no set has a target", () => {
    expect(planDistanceRange([{}, { distance: null }], "m")).toBeUndefined();
  });
});
