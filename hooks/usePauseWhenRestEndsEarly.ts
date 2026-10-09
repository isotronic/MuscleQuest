import { useEffect, type RefObject } from "react";

// Within this much of the expiry, a stop is the rest running out.
const EXPIRY_SLACK_MS = 1000;

/**
 * Pauses a screen's react-timer-hook countdown when the store's rest stops
 * before it runs out (Skip, or a set completed mid-rest). The hook only
 * reads autoStart once, so without this it still expires at the old time
 * and plays the rest cue mid-set. A rest that ran out is left alone, so a
 * second screen's countdown still reaches its own expiry and cue.
 */
export function usePauseWhenRestEndsEarly(
  timerRunning: boolean,
  expiryRef: RefObject<Date | null>,
  pause: () => void,
) {
  useEffect(() => {
    if (timerRunning) return;
    const expiry = expiryRef.current;
    if (expiry && expiry.getTime() - Date.now() > EXPIRY_SLACK_MS) pause();
  }, [timerRunning, expiryRef, pause]);
}
