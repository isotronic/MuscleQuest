import { renderHook } from "@testing-library/react-native";
import { useAppUpdates } from "../useAppUpdates";
import * as Updates from "expo-updates";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const devGlobal = globalThis as unknown as { __DEV__: boolean };

describe("useAppUpdates", () => {
  const originalDev = devGlobal.__DEV__;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // The hook short-circuits in dev mode; force the production code path so
    // the retry/unmount logic under test actually runs.
    devGlobal.__DEV__ = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    devGlobal.__DEV__ = originalDev;
  });

  it("does not call setState after unmount when the retry timer fires", async () => {
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(
      new Error("network error"),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { unmount } = renderHook(() => useAppUpdates());

    // Let the initial 3s mount-delay fire and the first checkForUpdateAsync call reject.
    await jest.advanceTimersByTimeAsync(3000);

    // Unmount before the 5s retry delay elapses.
    unmount();

    // Advance past the retry window. If the retry isn't cancelled, this throws
    // an "act" warning / continues calling React state setters after unmount.
    await jest.advanceTimersByTimeAsync(5000);

    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
