// Opening SQLite databases, and file-level operations on them.
import * as SQLite from "expo-sqlite";
import type { File } from "expo-file-system";
import { getSchemaVersion } from "@/utils/db/runMigrations";

const BUSY_TIMEOUT_PRAGMA = "PRAGMA busy_timeout = 3000;";

export const openDatabase = async (
  databaseName: string,
): Promise<SQLite.SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });
  await db.execAsync(BUSY_TIMEOUT_PRAGMA);

  // withExclusiveTransactionAsync runs on a second connection that expo-sqlite
  // opens itself, and pragmas are per connection. Without this the transaction
  // fails with "database is locked" the instant another connection holds the
  // write lock, instead of waiting like every other query does.
  const runExclusive = db.withExclusiveTransactionAsync.bind(db);
  db.withExclusiveTransactionAsync = (task) =>
    runExclusive(async (txn) => {
      await txn.execAsync(BUSY_TIMEOUT_PRAGMA);
      await task(txn);
    });
  return db;
};

// expo-sqlite takes a plain filesystem path for its directory argument and for
// VACUUM INTO, not a file:// URI.
const toFsPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ""));

// Writes a consistent, self-contained copy of userData.db (including anything
// still in the WAL) to `target`. VACUUM INTO leaves the live file and its WAL
// untouched, so no checkpoint of the live database is needed.
export const createDatabaseSnapshot = async (target: File): Promise<File> => {
  // VACUUM INTO fails if the target already exists.
  if (target.exists) {
    target.delete();
  }
  const escapedPath = toFsPath(target.uri).replace(/'/g, "''");
  const db = await openDatabase("userData.db");
  try {
    await db.execAsync(`VACUUM INTO '${escapedPath}'`);
  } finally {
    await db.closeAsync();
  }
  return target;
};

// Runs PRAGMA integrity_check on a database file outside the default SQLite
// directory. True only when SQLite reports a single "ok" row.
export const checkDatabaseIntegrity = async (file: File): Promise<boolean> => {
  const db = await SQLite.openDatabaseAsync(
    file.name,
    { useNewConnection: true },
    toFsPath(file.parentDirectory.uri),
  );
  try {
    const rows = await db.getAllAsync<{ integrity_check: string }>(
      "PRAGMA integrity_check",
    );
    return rows.length === 1 && rows[0].integrity_check === "ok";
  } finally {
    await db.closeAsync();
  }
};

// Reads PRAGMA user_version (the schema version, see utils/db/runMigrations.ts)
// from a database file outside the default SQLite directory.
export const readDatabaseSchemaVersion = async (
  file: File,
): Promise<number> => {
  const db = await SQLite.openDatabaseAsync(
    file.name,
    { useNewConnection: true },
    toFsPath(file.parentDirectory.uri),
  );
  try {
    return await getSchemaVersion(db);
  } finally {
    await db.closeAsync();
  }
};
