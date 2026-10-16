import {
  retryFirstLaunchSeeding,
  runSeedingSteps,
  startFirstLaunchSeeding,
  whenFilesSettled,
  whenSeeded,
} from "../firstLaunchSeeding";
import { useFirstLaunchSeedingStore } from "@/store/firstLaunchSeedingStore";
import {
  copyDataFromAppDataToUserData,
  syncExerciseFlagsFromAppData,
} from "@/utils/database";
import { loadPremadePlans } from "@/utils/loadPremadePlans";
import {
  exerciseImageFilesInFlight,
  startExerciseImageFiles,
} from "@/utils/exerciseImageFilesRun";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

jest.mock("@/utils/database", () => ({
  copyDataFromAppDataToUserData: jest.fn(),
  syncExerciseFlagsFromAppData: jest.fn(),
}));
jest.mock("@/utils/loadPremadePlans", () => ({ loadPremadePlans: jest.fn() }));
jest.mock("@/utils/exerciseImageFilesRun", () => ({
  startExerciseImageFiles: jest.fn(),
  exerciseImageFilesInFlight: jest.fn(() => null),
}));
jest.mock("@/utils/bugsnagDedup", () => ({ notifyBugsnag: jest.fn() }));

const mockCopy = copyDataFromAppDataToUserData as jest.Mock;
const steps = [
  copyDataFromAppDataToUserData,
  loadPremadePlans,
  syncExerciseFlagsFromAppData,
] as jest.Mock[];

const status = () => useFirstLaunchSeedingStore.getState().status;

beforeEach(() => {
  jest.clearAllMocks();
  steps.forEach((step) => step.mockResolvedValue(undefined));
  (startExerciseImageFiles as jest.Mock).mockResolvedValue({
    written: 0,
    failed: 0,
  });
  (exerciseImageFilesInFlight as jest.Mock).mockReturnValue(null);
  useFirstLaunchSeedingStore.setState({ status: "idle" });
});

describe("runSeedingSteps", () => {
  it("copies the library, then plans, then exercise flags", async () => {
    const order: string[] = [];
    mockCopy.mockImplementation(async () => order.push("copy"));
    (loadPremadePlans as jest.Mock).mockImplementation(async () =>
      order.push("plans"),
    );
    (syncExerciseFlagsFromAppData as jest.Mock).mockImplementation(async () =>
      order.push("flags"),
    );

    await runSeedingSteps();

    expect(order).toEqual(["copy", "plans", "flags"]);
  });
});

describe("startFirstLaunchSeeding", () => {
  it("is done after the steps and starts the thumbnail files", async () => {
    await startFirstLaunchSeeding();

    expect(status()).toBe("done");
    expect(startExerciseImageFiles).toHaveBeenCalledTimes(1);
    await expect(whenSeeded()).resolves.toBeUndefined();
  });

  it("joins a run in progress", async () => {
    let finish: () => void = () => {};
    mockCopy.mockReturnValue(new Promise<void>((r) => (finish = r)));

    const first = startFirstLaunchSeeding();
    const second = startFirstLaunchSeeding();
    expect(status()).toBe("running");
    finish();
    await Promise.all([first, second]);

    expect(mockCopy).toHaveBeenCalledTimes(1);
  });

  it("reports a failure and makes whenSeeded reject", async () => {
    const error = new Error("disk full");
    mockCopy.mockRejectedValueOnce(error);

    await startFirstLaunchSeeding();

    expect(status()).toBe("failed");
    expect(notifyBugsnag).toHaveBeenCalledWith(error);
    await expect(whenSeeded()).rejects.toThrow("disk full");
    expect(startExerciseImageFiles).not.toHaveBeenCalled();
  });

  it("runs again on retry after a failure", async () => {
    mockCopy.mockRejectedValueOnce(new Error("disk full"));
    await startFirstLaunchSeeding();

    await retryFirstLaunchSeeding();

    expect(status()).toBe("done");
    expect(mockCopy).toHaveBeenCalledTimes(2);
    await expect(whenSeeded()).resolves.toBeUndefined();
  });
});

describe("retryFirstLaunchSeeding", () => {
  // Two quick taps on Try again must not copy the library twice.
  it("joins a retry already in progress", async () => {
    mockCopy.mockRejectedValueOnce(new Error("disk full"));
    await startFirstLaunchSeeding();
    let finish: () => void = () => {};
    mockCopy.mockReturnValueOnce(new Promise<void>((r) => (finish = r)));

    const first = retryFirstLaunchSeeding();
    const second = retryFirstLaunchSeeding();
    finish();
    await Promise.all([first, second]);

    expect(mockCopy).toHaveBeenCalledTimes(2);
  });
});

describe("whenSeeded", () => {
  it("resolves at once when no seeding was started", async () => {
    await expect(whenSeeded()).resolves.toBeUndefined();
  });
});

describe("whenFilesSettled", () => {
  it("waits for the thumbnail run in progress", async () => {
    let finish: () => void = () => {};
    const run = new Promise((r) => (finish = () => r({ written: 1 })));
    (exerciseImageFilesInFlight as jest.Mock).mockReturnValue(run);
    let settled = false;

    const waiting = whenFilesSettled().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await waiting;

    expect(settled).toBe(true);
  });

  it("does not reject after a failed seeding", async () => {
    mockCopy.mockRejectedValueOnce(new Error("disk full"));
    await startFirstLaunchSeeding();

    await expect(whenFilesSettled()).resolves.toBeUndefined();
  });
});
