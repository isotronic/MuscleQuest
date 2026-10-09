type Units = typeof import("../units");

function loadWithSeparator(decimalSeparator: string): Units {
  let mod: Units | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-localization", () => ({
      getLocales: () => [{ decimalSeparator }],
    }));
    mod = require("../units");
  });
  return mod!;
}

describe("formatWeight follows the device separator", () => {
  it("shows a comma on a comma device", () => {
    expect(loadWithSeparator(",").formatWeight(62.5, "kg")).toBe("62,5");
  });

  it("shows a dot on a dot device", () => {
    expect(loadWithSeparator(".").formatWeight(62.5, "kg")).toBe("62.5");
  });
});
