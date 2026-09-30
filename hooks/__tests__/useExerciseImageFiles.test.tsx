import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  EXERCISE_IMAGE_FILES_DELAY_MS,
  useExerciseImageFiles,
} from "../useExerciseImageFiles";
import { writeExerciseImageFiles } from "@/utils/db/exerciseImageFiles";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

jest.mock("@/utils/db/exerciseImageFiles", () => ({
  writeExerciseImageFiles: jest.fn(),
}));
jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));

const mockWrite = writeExerciseImageFiles as jest.Mock;

const setup = () => {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    invalidate,
    ...renderHook(() => useExerciseImageFiles(), { wrapper }),
  };
};

// Lets the start delay pass and the run's promise chain settle.
const passStartDelay = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(EXERCISE_IMAGE_FILES_DELAY_MS);
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useExerciseImageFiles", () => {
  it("stays out of the way while the first screen renders", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    setup();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(EXERCISE_IMAGE_FILES_DELAY_MS - 1);
    });

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("starts once the delay has passed", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    setup();
    await passStartDelay();

    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("never starts if it is unmounted before the delay passes", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    const { unmount } = setup();
    unmount();
    await passStartDelay();

    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("refreshes cached queries once new image files were written", async () => {
    mockWrite.mockResolvedValue({ written: 12, failed: 0 });

    const { invalidate } = setup();
    await passStartDelay();

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("leaves the cache alone when every image was already on disk", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    const { invalidate } = setup();
    await passStartDelay();

    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not start a second run while one is in flight", async () => {
    let finish: (value: { written: number; failed: number }) => void = () => {};
    mockWrite.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = setup();
    await passStartDelay();
    first.unmount();
    setup();
    await passStartDelay();

    expect(mockWrite).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ written: 0, failed: 0 });
    });
  });

  it("reports a failed run without throwing", async () => {
    const error = new Error("database is locked");
    mockWrite.mockRejectedValue(error);

    setup();
    await passStartDelay();

    expect(notifyBugsnag).toHaveBeenCalledWith(error);
  });
});
