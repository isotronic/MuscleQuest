import {
  restCountdownAnnouncement,
  setCompleteAnnouncement,
} from "../a11yAnnouncements";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));

describe("setCompleteAnnouncement", () => {
  it("includes the rest that follows", () => {
    expect(setCompleteAnnouncement(2, 90)).toBe("Set 2 complete. Rest 1:30.");
  });

  it("pads seconds", () => {
    expect(setCompleteAnnouncement(1, 65)).toBe("Set 1 complete. Rest 1:05.");
  });

  it("omits rest when there is none", () => {
    expect(setCompleteAnnouncement(3, 0)).toBe("Set 3 complete.");
    expect(setCompleteAnnouncement(3, null)).toBe("Set 3 complete.");
  });
});

describe("restCountdownAnnouncement", () => {
  it("announces when the countdown reaches 30 and 10 seconds", () => {
    expect(restCountdownAnnouncement(31, 30)).toBe("30 seconds of rest left");
    expect(restCountdownAnnouncement(11, 10)).toBe("10 seconds of rest left");
  });

  it("announces the end of rest", () => {
    expect(restCountdownAnnouncement(1, 0)).toBe("Rest over");
  });

  it("stays quiet between thresholds", () => {
    expect(restCountdownAnnouncement(45, 44)).toBeNull();
    expect(restCountdownAnnouncement(30, 29)).toBeNull();
    expect(restCountdownAnnouncement(10, 9)).toBeNull();
  });

  it("reports the real time left when an adjustment jumps past a threshold", () => {
    expect(restCountdownAnnouncement(40, 25)).toBe("25 seconds of rest left");
  });

  it("stays quiet when time is added", () => {
    expect(restCountdownAnnouncement(20, 35)).toBeNull();
  });

  it("stays quiet with no previous reading", () => {
    expect(restCountdownAnnouncement(null, 30)).toBeNull();
  });

  it("uses the singular form for one second", () => {
    expect(restCountdownAnnouncement(12, 1)).toBe("1 second of rest left");
  });
});
