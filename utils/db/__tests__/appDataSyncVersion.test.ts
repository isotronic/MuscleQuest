import {
  APP_DATA_SYNC,
  getAppDataSyncVersion,
  legacyDataVersionToSyncVersion,
  setAppDataSyncVersion,
} from "@/utils/db/appDataSyncVersion";

const dbWithSettings = (settings: Record<string, string>) => {
  const db = {
    getFirstAsync: jest.fn(async (_sql: string, [key]: string[]) =>
      key in settings ? { value: settings[key] } : null,
    ),
    runAsync: jest.fn(async (_sql: string, [key, value]: string[]) => {
      settings[key] = value;
    }),
  };
  return db as any;
};

describe("legacyDataVersionToSyncVersion", () => {
  it.each([
    [null, APP_DATA_SYNC.none],
    [undefined, APP_DATA_SYNC.none],
    ["garbage", APP_DATA_SYNC.none],
    ["1.0", APP_DATA_SYNC.none],
    ["1.1", APP_DATA_SYNC.legacyInstall],
    ["1.2", APP_DATA_SYNC.exerciseIdsLinked],
    ["1.5", APP_DATA_SYNC.exerciseIdsLinked],
    ["1.7", APP_DATA_SYNC.exercisesCopied],
    ["1.8", APP_DATA_SYNC.premadePlansV1],
    ["1.9", APP_DATA_SYNC.premadePlansV1],
    ["2.0", APP_DATA_SYNC.exerciseFlagsSynced],
    ["2.1", APP_DATA_SYNC.premadePlansV2],
  ])("maps %s to %s", (legacy, expected) => {
    expect(legacyDataVersionToSyncVersion(legacy)).toBe(expected);
  });
});

describe("getAppDataSyncVersion", () => {
  it("is 0 when neither setting exists", async () => {
    expect(await getAppDataSyncVersion(dbWithSettings({}))).toBe(0);
  });

  it("derives the version from a legacy dataVersion", async () => {
    const db = dbWithSettings({ dataVersion: "1.8" });
    expect(await getAppDataSyncVersion(db)).toBe(APP_DATA_SYNC.premadePlansV1);
  });

  it("prefers the integer setting over the legacy one", async () => {
    const db = dbWithSettings({ appDataSyncVersion: "10", dataVersion: "2.1" });
    expect(await getAppDataSyncVersion(db)).toBe(10);
  });

  it("orders 10 above 7, which the float dataVersion could not", async () => {
    const ten = await getAppDataSyncVersion(
      dbWithSettings({ appDataSyncVersion: "10" }),
    );
    const seven = await getAppDataSyncVersion(
      dbWithSettings({ appDataSyncVersion: "7" }),
    );
    expect(ten).toBeGreaterThan(seven);
  });

  it("ignores a non-integer value in the integer setting", async () => {
    const db = dbWithSettings({
      appDataSyncVersion: "2.0",
      dataVersion: "1.7",
    });
    expect(await getAppDataSyncVersion(db)).toBe(APP_DATA_SYNC.exercisesCopied);
  });
});

describe("setAppDataSyncVersion", () => {
  it("writes the integer and the matching legacy dataVersion", async () => {
    const settings: Record<string, string> = {};
    await setAppDataSyncVersion(
      dbWithSettings(settings),
      APP_DATA_SYNC.premadePlansV1,
    );
    expect(settings).toEqual({ appDataSyncVersion: "4", dataVersion: "1.8" });
  });

  it("leaves dataVersion alone for steps that have no legacy value", async () => {
    const settings: Record<string, string> = { dataVersion: "2.1" };
    await setAppDataSyncVersion(dbWithSettings(settings), 7);
    expect(settings).toEqual({ appDataSyncVersion: "7", dataVersion: "2.1" });
  });

  it("round-trips through getAppDataSyncVersion", async () => {
    const db = dbWithSettings({});
    await setAppDataSyncVersion(db, APP_DATA_SYNC.exerciseFlagsSynced);
    expect(await getAppDataSyncVersion(db)).toBe(
      APP_DATA_SYNC.exerciseFlagsSynced,
    );
  });
});
