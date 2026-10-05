type NumberFormat = typeof import("../numberFormat");

function loadWithSeparator(decimalSeparator: string | null): NumberFormat {
  let mod: NumberFormat | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-localization", () => ({
      getLocales: () =>
        decimalSeparator === null ? [] : [{ decimalSeparator }],
    }));
    mod = require("../numberFormat");
  });
  return mod!;
}

describe("numberFormat with a comma device", () => {
  const nf = loadWithSeparator(",");

  it("reads the separator from the device region", () => {
    expect(nf.DECIMAL_SEPARATOR).toBe(",");
  });

  it.each([
    ["62,5", "62.5"],
    ["62.5", "62.5"],
    ["1,2,3", "1.23"],
    ["1.2,3", "1.23"],
    [".", "."],
    ["", ""],
    ["abc", ""],
    ["0,", "0."],
    ["-5", "5"],
    [" 62,5 kg", "62.5"],
  ])("toCanonicalDecimal(%j) is %j", (input, expected) => {
    expect(nf.toCanonicalDecimal(input)).toBe(expected);
  });

  it("shows canonical values with the device separator", () => {
    expect(nf.toDisplayDecimal("62.5")).toBe("62,5");
    expect(nf.toDisplayDecimal("62.")).toBe("62,");
    expect(nf.toDisplayDecimal("60")).toBe("60");
  });

  it("parses input text to a number or null", () => {
    expect(nf.parseDecimalInput("62,5")).toBe(62.5);
    expect(nf.parseDecimalInput("62.5")).toBe(62.5);
    expect(nf.parseDecimalInput("")).toBeNull();
    expect(nf.parseDecimalInput(".")).toBeNull();
    expect(nf.parseDecimalInput("abc")).toBeNull();
  });

  it("formats numbers with the device separator", () => {
    expect(nf.formatDecimal(62.5, 1)).toBe("62,5");
    expect(nf.formatDecimal(62, 2)).toBe("62,00");
    expect(nf.formatDecimal(62, 0)).toBe("62");
  });

  it("keeps only digits for integer input", () => {
    expect(nf.sanitizeIntegerInput("12")).toBe("12");
    expect(nf.sanitizeIntegerInput("1.2")).toBe("12");
    expect(nf.sanitizeIntegerInput("1,2")).toBe("12");
    expect(nf.sanitizeIntegerInput("-3a")).toBe("3");
  });
});

describe("numberFormat with a point device", () => {
  const nf = loadWithSeparator(".");

  it("leaves canonical values untouched for display", () => {
    expect(nf.DECIMAL_SEPARATOR).toBe(".");
    expect(nf.toDisplayDecimal("62.5")).toBe("62.5");
    expect(nf.formatDecimal(62.5, 1)).toBe("62.5");
  });

  it("still accepts a comma typed on the keyboard", () => {
    expect(nf.toCanonicalDecimal("62,5")).toBe("62.5");
  });
});

describe("numberFormat with no locale information", () => {
  it("falls back to a point", () => {
    expect(loadWithSeparator(null).DECIMAL_SEPARATOR).toBe(".");
  });
});
