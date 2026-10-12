import { settingsBodyWeight } from "../settingsBodyWeight";

describe("settingsBodyWeight", () => {
  it("reads the display-unit setting as display and canonical kg", () => {
    // fetchSettings returns 80 kg as "176.4" for a pounds user.
    const lbs = settingsBodyWeight({ bodyWeight: "176.4", weightUnit: "lbs" });
    expect(lbs.display).toBe(176.4);
    expect(lbs.kg).toBeCloseTo(80.01, 2);
    expect(settingsBodyWeight({ bodyWeight: "80", weightUnit: "kg" })).toEqual({
      display: 80,
      kg: 80,
    });
  });

  it("gives null when no body weight is set", () => {
    expect(settingsBodyWeight({ weightUnit: "kg" })).toEqual({
      display: null,
      kg: null,
    });
    expect(settingsBodyWeight(undefined)).toEqual({ display: null, kg: null });
  });
});
