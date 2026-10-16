import { act, renderHook } from "@testing-library/react-native";
import { useWhenSeeded } from "../useWhenSeeded";
import {
  retryFirstLaunchSeeding,
  whenSeeded,
} from "@/utils/firstLaunchSeeding";
import { useFirstLaunchSeedingStore } from "@/store/firstLaunchSeedingStore";

jest.mock("@/utils/firstLaunchSeeding", () => ({
  whenSeeded: jest.fn(),
  retryFirstLaunchSeeding: jest.fn(),
}));

const mockWhenSeeded = whenSeeded as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (retryFirstLaunchSeeding as jest.Mock).mockResolvedValue(undefined);
  useFirstLaunchSeedingStore.setState({ status: "done" });
});

describe("useWhenSeeded", () => {
  it("runs the action once seeding is done", async () => {
    mockWhenSeeded.mockResolvedValue(undefined);
    const action = jest.fn();
    const { result } = renderHook(() => useWhenSeeded());

    await act(() => result.current.run(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.failed).toBe(false);
  });

  // A button that flashed "Almost ready" before every action looked broken.
  it("never shows waiting when seeding is already done", async () => {
    let finish: () => void = () => {};
    mockWhenSeeded.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => useWhenSeeded());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.run(jest.fn());
    });
    expect(result.current.waiting).toBe(false);

    await act(async () => {
      finish();
      await pending;
    });
  });

  it("shows it is waiting while seeding runs", async () => {
    useFirstLaunchSeedingStore.setState({ status: "running" });
    let finish: () => void = () => {};
    mockWhenSeeded.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const action = jest.fn();
    const { result } = renderHook(() => useWhenSeeded());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.run(action);
    });
    expect(result.current.waiting).toBe(true);
    expect(action).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.waiting).toBe(false);
    expect(action).toHaveBeenCalled();
  });

  it("fails without running the action when seeding failed", async () => {
    mockWhenSeeded.mockRejectedValue(new Error("disk full"));
    const action = jest.fn();
    const { result } = renderHook(() => useWhenSeeded());

    await act(() => result.current.run(action));

    expect(result.current.failed).toBe(true);
    expect(result.current.waiting).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("retries seeding and then the action", async () => {
    mockWhenSeeded.mockRejectedValueOnce(new Error("disk full"));
    const action = jest.fn();
    const { result } = renderHook(() => useWhenSeeded());
    await act(() => result.current.run(action));

    mockWhenSeeded.mockResolvedValue(undefined);
    await act(() => result.current.retry());

    expect(retryFirstLaunchSeeding).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.failed).toBe(false);
  });
});
