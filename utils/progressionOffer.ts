import { differenceInCalendarDays } from "date-fns";
import { localDateKeyToDate } from "@/utils/dates";

/** Setting that records the answer to the summary's progression offer. */
export const PROGRESSION_OFFER_SETTING = "progressionOfferAnswered";

/** Saved-workout sessions before the offer appears. */
export const PROGRESSION_OFFER_MIN_SESSIONS = 3;

/** Days before a first "Not now" is asked once more. */
export const PROGRESSION_OFFER_RETRY_DAYS = 30;

// Stored answers: "on" (turned on from the offer), a YYYY-MM-DD day key (the
// first "Not now"), or "later" (a second "Not now": never ask again).
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function shouldOfferProgression({
  enabled,
  fromSavedWorkout,
  savedSessionCount,
  answer,
  today,
}: {
  enabled: boolean;
  /** The session came from a plan or a saved workout. */
  fromSavedWorkout: boolean;
  savedSessionCount: number;
  answer: string | undefined;
  /** Today's local day key. */
  today: string;
}): boolean {
  if (enabled || !fromSavedWorkout) return false;
  if (savedSessionCount < PROGRESSION_OFFER_MIN_SESSIONS) return false;
  if (!answer) return true;
  if (!DAY_KEY.test(answer)) return false;
  return (
    differenceInCalendarDays(
      localDateKeyToDate(today),
      localDateKeyToDate(answer),
    ) >= PROGRESSION_OFFER_RETRY_DAYS
  );
}

/** What to store for "Not now": the day the first time, then never again. */
export function notNowAnswer(answer: string | undefined, today: string) {
  return answer && DAY_KEY.test(answer) ? "later" : today;
}
