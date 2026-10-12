import { localeDefaults } from "../localeDefaults";

const mockLocales = jest.fn();
const mockCalendars = jest.fn();
jest.mock("expo-localization", () => ({
  getLocales: () => mockLocales(),
  getCalendars: () => mockCalendars(),
}));

const locale = (regionCode: string | null, measurementSystem: string | null) =>
  mockLocales.mockReturnValue([{ regionCode, measurementSystem }]);
const firstWeekday = (day: number | null) =>
  mockCalendars.mockReturnValue([{ firstWeekday: day }]);

describe("localeDefaults", () => {
  it("gives pounds, feet, inches, 5 lb steps and Sunday weeks in the US", () => {
    locale("US", "us");
    firstWeekday(1);
    expect(localeDefaults()).toEqual({
      weightUnit: "lbs",
      distanceUnit: "ft",
      sizeUnit: "in",
      weightIncrement: "5",
      weekStartsOn: "0",
    });
  });

  it("gives kilograms, metres, 2.5 kg steps and Monday weeks in Germany", () => {
    locale("DE", "metric");
    firstWeekday(2);
    expect(localeDefaults()).toEqual({
      weightUnit: "kg",
      distanceUnit: "m",
      sizeUnit: "cm",
      weightIncrement: "2.5",
      weekStartsOn: "1",
    });
  });

  it("uses the region when the measurement system is missing", () => {
    locale("LR", null);
    firstWeekday(1);
    expect(localeDefaults().weightUnit).toBe("lbs");
    locale("GB", "uk");
    expect(localeDefaults().weightUnit).toBe("kg");
  });

  it("falls back to Monday for a Saturday or unknown first weekday", () => {
    locale("EG", "metric");
    firstWeekday(7);
    expect(localeDefaults().weekStartsOn).toBe("1");
    firstWeekday(null);
    expect(localeDefaults().weekStartsOn).toBe("1");
    mockCalendars.mockReturnValue([]);
    expect(localeDefaults().weekStartsOn).toBe("1");
  });

  it("falls back to metric when the device reports nothing", () => {
    mockLocales.mockReturnValue([]);
    firstWeekday(null);
    expect(localeDefaults().weightUnit).toBe("kg");
  });
});
