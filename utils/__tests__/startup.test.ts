import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import Bugsnag from "@bugsnag/expo";
import {
  runStartup,
  undoLastRestoreAndReload,
  DATABASE_RESTORED_KEY,
  STARTUP_FAILURE_COUNT_KEY,
} from "../startup";
import { initializeAppData } from "@/utils/initAppDataDB";
import { initUserDataDB } from "@/utils/initUserDataDB";
import {
  copyDataFromAppDataToUserData,
  insertDefaultSettings,
  syncExerciseFlagsFromAppData,
  updateAppExerciseIds,
} from "@/utils/database";
import { loadPremadePlans } from "@/utils/loadPremadePlans";
import {
  confirmRestoredDatabase,
  hasRestoreToUndo,
  recoverInterruptedRestore,
  undoLastRestore,
} from "@/utils/restoreRollback";
import { resetLocalSessionStateAfterHydration } from "@/utils/resetLocalState";
import { forgetExerciseImageFiles } from "@/utils/db/exerciseImageFiles";

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn(), leaveBreadcrumb: jest.fn() },
}));
jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));
jest.mock("@/utils/initAppDataDB", () => ({
  initializeAppData: jest.fn(),
}));
jest.mock("@/utils/initUserDataDB", () => ({
  initUserDataDB: jest.fn(),
}));
jest.mock("@/utils/database", () => ({
  copyDataFromAppDataToUserData: jest.fn(),
  insertDefaultSettings: jest.fn(),
  syncExerciseFlagsFromAppData: jest.fn(),
  updateAppExerciseIds: jest.fn(),
}));
jest.mock("@/utils/loadPremadePlans", () => ({
  loadPremadePlans: jest.fn(),
}));
jest.mock("@/utils/db/exerciseImageFiles", () => ({
  forgetExerciseImageFiles: jest.fn(),
}));
jest.mock("@/utils/restoreRollback", () => ({
  recoverInterruptedRestore: jest.fn(() => false),
  confirmRestoredDatabase: jest.fn(),
  undoLastRestore: jest.fn(() => true),
  hasRestoreToUndo: jest.fn(() => false),
}));
jest.mock("@/utils/resetLocalState", () => ({
  resetLocalSessionStateAfterHydration: jest.fn(() => Promise.resolve(true)),
}));

const initSteps = [
  initializeAppData,
  initUserDataDB,
  copyDataFromAppDataToUserData,
  updateAppExerciseIds,
  insertDefaultSettings,
  loadPremadePlans,
  syncExerciseFlagsFromAppData,
] as jest.Mock[];

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  await AsyncStorage.clear();
  initSteps.forEach((step) => step.mockResolvedValue(undefined));
  (Updates.reloadAsync as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("runStartup after a restore", () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(DATABASE_RESTORED_KEY, "true");
  });

  it("runs schema migrations", async () => {
    await runStartup();
    expect(initUserDataDB).toHaveBeenCalled();
  });

  it("runs every version-gated seeding step", async () => {
    await runStartup();
    initSteps.forEach((step) => expect(step).toHaveBeenCalledTimes(1));
  });

  // The restored uris describe files written for another database.
  it("forgets recorded thumbnail files once the schema is migrated", async () => {
    const order: string[] = [];
    (initUserDataDB as jest.Mock).mockImplementation(async () => {
      order.push("migrate");
    });
    (forgetExerciseImageFiles as jest.Mock).mockImplementation(async () => {
      order.push("forget");
    });

    await runStartup();

    expect(order).toEqual(["migrate", "forget"]);
  });

  it("clears the restore flag after a successful init", async () => {
    const result = await runStartup();
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBeNull();
  });

  it("keeps the restore flag when init fails", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(
      new Error("no such column"),
    );
    await runStartup();
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });

  it("clears the session again, in case the reset before the reload failed", async () => {
    await runStartup();
    expect(resetLocalSessionStateAfterHydration).toHaveBeenCalled();
  });

  it("keeps the restore flag so the next boot retries a failed session reset", async () => {
    (resetLocalSessionStateAfterHydration as jest.Mock).mockResolvedValueOnce(
      false,
    );
    const result = await runStartup();
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });

  it("drops the pre-restore database once the restored one booted", async () => {
    await runStartup();
    expect(confirmRestoredDatabase).toHaveBeenCalled();
  });

  it("keeps the pre-restore database when the restored one fails to boot", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(
      new Error("no such column"),
    );
    await runStartup();
    expect(confirmRestoredDatabase).not.toHaveBeenCalled();
  });
});

describe("runStartup after a swap that was killed before the restore finished", () => {
  beforeEach(() => {
    (hasRestoreToUndo as jest.Mock).mockReturnValue(true);
  });
  afterEach(() => {
    (hasRestoreToUndo as jest.Mock).mockReturnValue(false);
  });

  it("clears the replaced database's session before anything renders", async () => {
    await runStartup();
    expect(resetLocalSessionStateAfterHydration).toHaveBeenCalled();
  });

  it("treats the boot as the first after a restore", async () => {
    await runStartup();
    expect(forgetExerciseImageFiles).toHaveBeenCalled();
  });

  it("keeps the restore flag for the next boot when the session reset fails", async () => {
    (resetLocalSessionStateAfterHydration as jest.Mock).mockResolvedValueOnce(
      false,
    );
    const result = await runStartup();
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });
});

describe("runStartup without a pending restore", () => {
  it("leaves the session alone", async () => {
    await runStartup();
    expect(resetLocalSessionStateAfterHydration).not.toHaveBeenCalled();
  });
});

describe("undoLastRestoreAndReload", () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(DATABASE_RESTORED_KEY, "true");
    await AsyncStorage.setItem(STARTUP_FAILURE_COUNT_KEY, "2");
  });

  it("puts the old database back, clears the restore state and reloads", async () => {
    await undoLastRestoreAndReload();

    expect(undoLastRestore).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)).toBeNull();
    expect(Updates.reloadAsync).toHaveBeenCalled();
  });

  it("does not reload into the same failure when there was nothing to undo", async () => {
    (undoLastRestore as jest.Mock).mockReturnValueOnce(false);

    await expect(undoLastRestoreAndReload()).rejects.toThrow();
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("propagates a failed undo without reloading", async () => {
    (undoLastRestore as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Move failed");
    });

    await expect(undoLastRestoreAndReload()).rejects.toThrow("Move failed");
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });
});

describe("runStartup on an ordinary boot", () => {
  it("keeps the recorded thumbnail files", async () => {
    await runStartup();

    expect(initUserDataDB).toHaveBeenCalled();
    expect(forgetExerciseImageFiles).not.toHaveBeenCalled();
  });
});

describe("runStartup failure handling", () => {
  it("reloads exactly once across two failing boots, then reports failure", async () => {
    const error = new Error("disk full");
    (initUserDataDB as jest.Mock).mockRejectedValue(error);

    const first = await runStartup();
    expect(first).toEqual({ status: "reloading" });

    const second = await runStartup();
    expect(second).toEqual({ status: "failed", error });

    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(Bugsnag.notify).toHaveBeenCalledTimes(2);
  });

  it("reports failure when the single reload cannot run", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(new Error("boom"));
    (Updates.reloadAsync as jest.Mock).mockRejectedValue(
      new Error("reload unavailable"),
    );

    const result = await runStartup();
    expect(result.status).toBe("failed");
  });

  it("does not reload when the failure count cannot be persisted", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(new Error("boom"));
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("storage full"));

    const result = await runStartup();
    expect(result.status).toBe("failed");
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("does not reload when the failure count cannot be read", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(new Error("boom"));
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValueOnce(null) // databaseRestored read
      .mockRejectedValueOnce(new Error("storage unavailable"));

    const result = await runStartup();
    expect(result.status).toBe("failed");
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });

  it("runs the 1.1 exercise id migration before copying app data", async () => {
    await runStartup();
    const idOrder = (updateAppExerciseIds as jest.Mock).mock
      .invocationCallOrder[0];
    const copyOrder = (copyDataFromAppDataToUserData as jest.Mock).mock
      .invocationCallOrder[0];
    expect(idOrder).toBeLessThan(copyOrder);
  });

  it("does not report ok or clear the restore flag when a migration fails", async () => {
    await AsyncStorage.setItem(DATABASE_RESTORED_KEY, "true");
    (syncExerciseFlagsFromAppData as jest.Mock).mockRejectedValue(
      new Error("sync failed"),
    );

    const result = await runStartup();
    expect(result.status).not.toBe("ok");
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });

  it("undoes an interrupted restore before opening any database", async () => {
    await runStartup();
    const recoverOrder = (recoverInterruptedRestore as jest.Mock).mock
      .invocationCallOrder[0];
    initSteps.forEach((step) =>
      expect(recoverOrder).toBeLessThan(step.mock.invocationCallOrder[0]),
    );
  });

  it("fails startup without opening a database when the restore can't be undone", async () => {
    (recoverInterruptedRestore as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Move failed");
    });

    const result = await runStartup();

    expect(result.status).not.toBe("ok");
    initSteps.forEach((step) => expect(step).not.toHaveBeenCalled());
  });

  it("resets the failure count after a successful boot", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValueOnce(new Error("transient"));

    await runStartup();
    expect(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)).toBe("1");

    const result = await runStartup();
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)).toBeNull();
  });
});

describe("runStartup progress", () => {
  it("forwards first-launch progress with the stage it belongs to", async () => {
    (copyDataFromAppDataToUserData as jest.Mock).mockImplementation(
      async (onProgress?: (d: number, t: number) => void) => {
        onProgress?.(50, 780);
      },
    );
    (loadPremadePlans as jest.Mock).mockImplementation(
      async (onProgress?: (d: number, t: number) => void) => {
        onProgress?.(3, 7);
      },
    );
    const onProgress = jest.fn();

    await runStartup(onProgress);

    expect(onProgress.mock.calls).toEqual([
      [{ stage: "exercises", done: 50, total: 780 }],
      [{ stage: "plans", done: 3, total: 7 }],
    ]);
  });

  it("reports nothing on a returning user's boot", async () => {
    const onProgress = jest.fn();
    await runStartup(onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("runStartup and App Check", () => {
  it("does not wait for App Check", async () => {
    const { appCheckReady } = jest.requireMock("@/utils/initAppCheck");
    (appCheckReady as jest.Mock).mockReturnValue(new Promise(() => {}));

    await expect(runStartup()).resolves.toEqual({ status: "ok" });

    (appCheckReady as jest.Mock).mockImplementation(() => Promise.resolve());
  });
});
