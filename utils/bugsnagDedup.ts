// Tracks error objects that have already been sent to Bugsnag by a hook or
// helper, so the global react-query safety net (QueryCache / MutationCache
// onError in app/_layout.tsx) does not report the same error a second time.
//
// Errors are held in a WeakSet keyed on the thrown object, so they are garbage
// collected with the error and never leak. Non-object errors (e.g. thrown
// strings) can't be tracked and will fall through to the global net, which is
// acceptable since those are rare.
import Bugsnag from "@bugsnag/expo";

const reportedErrors = new WeakSet<object>();

export function markReported(error: unknown): void {
  if (error !== null && typeof error === "object") {
    reportedErrors.add(error as object);
  }
}

export function wasReported(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    reportedErrors.has(error as object)
  );
}

type NotifyArgs = Parameters<typeof Bugsnag.notify>;

// Reports an error to Bugsnag and marks it so the global react-query safety
// net won't report it a second time. Use this in place of Bugsnag.notify
// anywhere the error may also surface through a query/mutation. Passes the
// error and optional onError callback straight through, preserving the exact
// call shape (and any metadata callback) of the original Bugsnag.notify call.
export function notifyBugsnag(
  error: unknown,
  onError?: NotifyArgs[1],
): void {
  if (onError) {
    Bugsnag.notify(error as NotifyArgs[0], onError);
  } else {
    Bugsnag.notify(error as NotifyArgs[0]);
  }
  markReported(error);
}
