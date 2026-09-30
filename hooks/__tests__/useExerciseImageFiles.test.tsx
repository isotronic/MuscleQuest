import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useExerciseImageFiles } from "../useExerciseImageFiles";
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useExerciseImageFiles", () => {
  it("refreshes cached queries once new image files were written", async () => {
    mockWrite.mockResolvedValue({ written: 12, failed: 0 });

    const { invalidate } = setup();

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("leaves the cache alone when every image was already on disk", async () => {
    mockWrite.mockResolvedValue({ written: 0, failed: 0 });

    const { invalidate } = setup();

    await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not start a second run while one is in flight", async () => {
    let finish: (value: { written: number; failed: number }) => void = () => {};
    mockWrite.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = setup();
    await waitFor(() => expect(mockWrite).toHaveBeenCalledTimes(1));
    first.unmount();
    setup();
    await Promise.resolve();

    expect(mockWrite).toHaveBeenCalledTimes(1);
    finish({ written: 0, failed: 0 });
  });

  it("reports a failed run without throwing", async () => {
    const error = new Error("database is locked");
    mockWrite.mockRejectedValue(error);

    setup();

    await waitFor(() => expect(notifyBugsnag).toHaveBeenCalledWith(error));
  });
});
