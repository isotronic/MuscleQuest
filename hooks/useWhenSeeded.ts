import { useCallback, useRef, useState } from "react";
import {
  retryFirstLaunchSeeding,
  whenSeeded,
} from "@/utils/firstLaunchSeeding";

type Action = () => Promise<void> | void;

/**
 * Runs an onboarding action that writes to userData.db only once the
 * background seeding is done, so the two never contend for the write lock.
 * `waiting` is for an "Almost ready" button state; `failed` for
 * SeedingFailedNotice, whose Try again calls `retry`.
 */
export const useWhenSeeded = () => {
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastAction = useRef<Action | null>(null);

  const run = useCallback(async (action: Action) => {
    lastAction.current = action;
    setFailed(false);
    setWaiting(true);
    try {
      await whenSeeded();
    } catch {
      // Reported by firstLaunchSeeding; the screen offers Try again.
      setFailed(true);
      return;
    } finally {
      setWaiting(false);
    }
    await action();
  }, []);

  const retry = useCallback(async () => {
    const action = lastAction.current;
    void retryFirstLaunchSeeding();
    if (action) await run(action);
  }, [run]);

  return { run, retry, waiting, failed };
};
