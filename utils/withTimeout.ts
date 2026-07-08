export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

// Firestore's getDocs()/getDoc() can hang indefinitely instead of rejecting
// when the connection is in a bad state (e.g. a stale gRPC channel after
// backgrounding), leaving a caller's isLoading stuck true forever with no
// error ever surfacing. Race the read against a timer so a stalled call
// always settles.
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};
