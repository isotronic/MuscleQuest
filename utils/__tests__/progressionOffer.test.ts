import { notNowAnswer, shouldOfferProgression } from "@/utils/progressionOffer";

const base = {
  enabled: false,
  fromSavedWorkout: true,
  savedSessionCount: 3,
  answer: undefined as string | undefined,
  today: "2026-10-11",
};

describe("shouldOfferProgression", () => {
  it("offers on the third saved-workout session, not before", () => {
    expect(shouldOfferProgression({ ...base, savedSessionCount: 2 })).toBe(
      false,
    );
    expect(shouldOfferProgression(base)).toBe(true);
  });

  it("does not offer once progression is on", () => {
    expect(shouldOfferProgression({ ...base, enabled: true })).toBe(false);
  });

  it("does not offer after Turn on, even if it is switched off again", () => {
    expect(shouldOfferProgression({ ...base, answer: "on" })).toBe(false);
  });

  it("does not offer after a quick workout", () => {
    expect(shouldOfferProgression({ ...base, fromSavedWorkout: false })).toBe(
      false,
    );
  });

  it("offers once more 30 days after Not now, then never", () => {
    expect(shouldOfferProgression({ ...base, answer: "2026-09-12" })).toBe(
      false,
    );
    expect(shouldOfferProgression({ ...base, answer: "2026-09-11" })).toBe(
      true,
    );
    expect(shouldOfferProgression({ ...base, answer: "later" })).toBe(false);
  });
});

describe("notNowAnswer", () => {
  it("stores the day the first time and 'later' the second", () => {
    expect(notNowAnswer(undefined, "2026-10-11")).toBe("2026-10-11");
    expect(notNowAnswer("2026-09-01", "2026-10-11")).toBe("later");
  });
});
