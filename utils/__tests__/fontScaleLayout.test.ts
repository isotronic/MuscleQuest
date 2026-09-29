import { tabBarHeight } from "../fontScaleLayout";

describe("tabBarHeight", () => {
  it("keeps the design height at the default text size", () => {
    expect(tabBarHeight(1, 0)).toBe(50);
    expect(tabBarHeight(1, 34)).toBe(84);
  });

  it("grows with the system font scale so labels are not clipped", () => {
    expect(tabBarHeight(2, 0)).toBeGreaterThanOrEqual(50 + 12);
    expect(tabBarHeight(1.3, 0)).toBeGreaterThan(50);
  });

  it("never shrinks below the design height", () => {
    expect(tabBarHeight(0.85, 0)).toBe(50);
  });
});
