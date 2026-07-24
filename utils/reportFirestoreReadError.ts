import Bugsnag from "@bugsnag/expo";
import { TimeoutError } from "./withTimeout";

// Reports a failed Firestore read to Bugsnag with the details needed to tell
// the failure modes apart: the Firestore error `code`
// (e.g. "firestore/unavailable" / "firestore/permission-denied") or, when the
// read stalled and was aborted by withTimeout, an `isTimeout` flag. The caller
// is expected to rethrow so react-query still surfaces the error to the UI.
export const reportFirestoreReadError = (
  scope: string,
  error: unknown,
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  Bugsnag.notify(err, (event) => {
    event.addMetadata("firestoreRead", {
      scope,
      code: (error as { code?: string })?.code ?? null,
      isTimeout: error instanceof TimeoutError,
      message: err.message,
    });
  });
};
