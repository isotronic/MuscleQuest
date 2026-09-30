import type { SQLiteDatabase } from "expo-sqlite";
import { migrations as allMigrations, type Migration } from "./migrations";

export const getSchemaVersion = async (db: SQLiteDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
};

// Brings userData.db up to the latest schema. Each pending migration runs in
// its own transaction together with the user_version bump, so a failure rolls
// both back and the next boot retries from the same version.
//
// A database newer than this bundle knows (an OTA rollback, or a restore that
// slipped past the backup check) is left as it is: there is no way down.
export const runMigrations = async (
  db: SQLiteDatabase,
  migrations: readonly Migration[] = allMigrations,
): Promise<number> => {
  let current = await getSchemaVersion(db);
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    console.log(
      `Running migration ${migration.version} (${migration.name})...`,
    );
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      // PRAGMA takes no bound parameters; version is a number from our own
      // migration list.
      await txn.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    current = migration.version;
  }
  return current;
};
