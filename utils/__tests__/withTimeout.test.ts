import { withTimeout, TimeoutError } from "../withTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves with the wrapped value when the promise settles before the timeout", async () => {
    const promise = withTimeout(Promise.resolve("data"), 1000, "test");

    await expect(promise).resolves.toBe("data");
  });

  it("rejects with the original error when the promise rejects before the timeout", async () => {
    const error = new Error("boom");
    const promise = withTimeout(Promise.reject(error), 1000, "test");
    promise.catch(() => {});

    await expect(promise).rejects.toBe(error);
  });

  it("rejects with a TimeoutError once the timeout elapses without the promise settling", async () => {
    const neverSettles = new Promise<string>(() => {});
    const promise = withTimeout(neverSettles, 1000, "friendSharedPlans");
    promise.catch(() => {});

    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await expect(promise).rejects.toThrow(
      "friendSharedPlans timed out after 1000ms",
    );
  });

  it("does not fire the timeout after the promise has already resolved", async () => {
    const promise = withTimeout(Promise.resolve("ok"), 1000, "test");

    await expect(promise).resolves.toBe("ok");

    // Advancing time after resolution must not throw an unhandled rejection.
    await jest.advanceTimersByTimeAsync(2000);
  });
});
