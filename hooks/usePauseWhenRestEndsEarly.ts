import { useEffect } from "react";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";

/**
 * Pauses a screen's react-timer-hook countdown when a rest is ended before
 * it runs out (Skip, or a set completed mid-rest), however little was left.
 * The hook only reads autoStart once, so without this it still expires at
 * the old time and plays the rest cue mid-set. A rest that runs out is
 * stopped with stopTimer instead, so a second screen's countdown still
 * reaches its own expiry and cue.
 */
export function usePauseWhenRestEndsEarly(pause: () => void) {
  const endedEarly = useActiveWorkoutStore(
    (s) => s.restEndedEarly && !s.timerRunning,
  );
  useEffect(() => {
    if (endedEarly) pause();
  }, [endedEarly, pause]);
}
