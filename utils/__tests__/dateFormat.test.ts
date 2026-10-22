import {
  calendarLocaleNames,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  formatTime,
} from "../dateFormat";

jest.mock("../numberFormat", () => ({ DEVICE_LOCALE: "de-DE" }));

// Monday 5 October 2026, 14:05 local time.
const moment = new Date(2026, 9, 5, 14, 5);

describe("dateFormat", () => {
  it("names days and months in the device region's language", () => {
    expect(formatShortDate(moment)).toBe("Mo., 5. Okt.");
    expect(formatLongDate(moment)).toBe("Montag, 5. Oktober");
  });

  it("uses the region's clock and date order", () => {
    expect(formatTime(moment)).toBe("14:05");
    expect(formatDateTime(moment)).toBe("05.10.2026, 14:05");
  });

  it("gives the calendars Sunday-first day names and January-first months", () => {
    const names = calendarLocaleNames("de-DE");
    expect(names.dayNames[0]).toBe("Sonntag");
    expect(names.dayNamesShort[1]).toBe("Mo");
    expect(names.monthNames[0]).toBe("Januar");
    expect(names.monthNamesShort).toHaveLength(12);
  });
});
