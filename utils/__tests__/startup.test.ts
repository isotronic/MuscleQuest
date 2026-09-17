import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import Bugsnag from "@bugsnag/expo";
import {
  runStartup,
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

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
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

describe("runStartup after a restore", () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(DATABASE_RESTORED_KEY, "true");
  });

  it("runs schema migrations", async () => {
    await runStartup(Promise.resolve());
    expect(initUserDataDB).toHaveBeenCalled();
  });

  it("runs every version-gated seeding step", async () => {
    await runStartup(Promise.resolve());
    initSteps.forEach((step) => expect(step).toHaveBeenCalledTimes(1));
  });

  it("clears the restore flag after a successful init", async () => {
    const result = await runStartup(Promise.resolve());
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBeNull();
  });

  it("keeps the restore flag when init fails", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(
      new Error("no such column"),
    );
    await runStartup(Promise.resolve());
    expect(await AsyncStorage.getItem(DATABASE_RESTORED_KEY)).toBe("true");
  });
});

describe("runStartup failure handling", () => {
  it("reloads exactly once across two failing boots, then reports failure", async () => {
    const error = new Error("disk full");
    (initUserDataDB as jest.Mock).mockRejectedValue(error);

    const first = await runStartup(Promise.resolve());
    expect(first).toEqual({ status: "reloading" });

    const second = await runStartup(Promise.resolve());
    expect(second).toEqual({ status: "failed", error });

    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(Bugsnag.notify).toHaveBeenCalledTimes(2);
  });

  it("reports failure when the single reload cannot run", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValue(new Error("boom"));
    (Updates.reloadAsync as jest.Mock).mockRejectedValue(
      new Error("reload unavailable"),
    );

    const result = await runStartup(Promise.resolve());
    expect(result.status).toBe("failed");
  });

  it("resets the failure count after a successful boot", async () => {
    (initUserDataDB as jest.Mock).mockRejectedValueOnce(new Error("transient"));

    await runStartup(Promise.resolve());
    expect(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)).toBe("1");

    const result = await runStartup(Promise.resolve());
    expect(result).toEqual({ status: "ok" });
    expect(await AsyncStorage.getItem(STARTUP_FAILURE_COUNT_KEY)).toBeNull();
  });
});
