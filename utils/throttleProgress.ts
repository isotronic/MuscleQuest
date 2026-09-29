import type { StartupProgress } from "@/utils/startup";

/**
 * Limits progress re-renders to one per `intervalMs` so drawing the bar does
 * not slow the copy it reports on. A finished stage or a new stage always
 * gets through, so the final state is never dropped.
 */
export function throttleProgress(
  fn: (progress: StartupProgress) => void,
  intervalMs: number,
  now: () => number = Date.now,
) {
  let lastAt = -Infinity;
  let lastStage: StartupProgress["stage"] | null = null;
  return (progress: StartupProgress) => {
    const t = now();
    const important =
      progress.stage !== lastStage || progress.done >= progress.total;
    if (!important && t - lastAt < intervalMs) return;
    lastAt = t;
    lastStage = progress.stage;
    fn(progress);
  };
}
