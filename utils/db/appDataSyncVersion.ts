import type { SQLiteDatabase } from "expo-sqlite";

// How far userData.db has been synced with the content shipped in the app
// (appData3.db exercises, premade plans). This is content state, not schema:
// the schema version is PRAGMA user_version (see utils/db/runMigrations.ts).
//
// Stored as an integer in the `appDataSyncVersion` setting. It replaces the
// float-like `dataVersion` setting, where "1.10" would have compared below
// "1.7". Each step keeps the legacy value it used to write alongside it.
export const APP_DATA_SYNC = {
  none: 0,
  legacyInstall: 1, // dataVersion "1.1"
  exerciseIdsLinked: 2, // "1.2"
  exercisesCopied: 3, // "1.7"
  premadePlansV1: 4, // "1.8"
  exerciseFlagsSynced: 5, // "2.0"
  premadePlansV2: 6, // "2.1"
} as const;

const SYNC_KEY = "appDataSyncVersion";
const LEGACY_KEY = "dataVersion";

// Highest first. A legacy value at or above the threshold maps to the step.
const LEGACY_THRESHOLDS: readonly (readonly [number, number])[] = [
  [2.1, APP_DATA_SYNC.premadePlansV2],
  [2.0, APP_DATA_SYNC.exerciseFlagsSynced],
  [1.8, APP_DATA_SYNC.premadePlansV1],
  [1.7, APP_DATA_SYNC.exercisesCopied],
  [1.2, APP_DATA_SYNC.exerciseIdsLinked],
  [1.1, APP_DATA_SYNC.legacyInstall],
];

const LEGACY_VALUES: Record<number, string> = {
  [APP_DATA_SYNC.legacyInstall]: "1.1",
  [APP_DATA_SYNC.exerciseIdsLinked]: "1.2",
  [APP_DATA_SYNC.exercisesCopied]: "1.7",
  [APP_DATA_SYNC.premadePlansV1]: "1.8",
  [APP_DATA_SYNC.exerciseFlagsSynced]: "2.0",
  [APP_DATA_SYNC.premadePlansV2]: "2.1",
};

export const legacyDataVersionToSyncVersion = (
  legacy: string | null | undefined,
): number => {
  const parsed = Number(legacy);
  if (legacy == null || isNaN(parsed)) return APP_DATA_SYNC.none;
  const match = LEGACY_THRESHOLDS.find(([threshold]) => parsed >= threshold);
  return match ? match[1] : APP_DATA_SYNC.none;
};

const readSetting = (db: SQLiteDatabase, key: string) =>
  db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ? LIMIT 1`,
    [key],
  );

// Databases written before the integer setting existed (older installs,
// restored older backups) only have dataVersion, so it is the fallback.
export const getAppDataSyncVersion = async (
  db: SQLiteDatabase,
): Promise<number> => {
  const stored = (await readSetting(db, SYNC_KEY))?.value;
  if (stored != null && /^\d+$/.test(stored)) return Number(stored);
  const legacy = (await readSetting(db, LEGACY_KEY))?.value;
  return legacyDataVersionToSyncVersion(legacy);
};

// Also writes the matching legacy dataVersion, so an OTA rollback to a bundle
// that still reads it does not redo steps that have already run.
export const setAppDataSyncVersion = async (
  db: SQLiteDatabase,
  version: number,
): Promise<void> => {
  const legacy = LEGACY_VALUES[version];
  if (legacy) {
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [LEGACY_KEY, legacy],
    );
  }
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [SYNC_KEY, String(version)],
  );
};
