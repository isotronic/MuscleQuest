import type { SQLiteDatabase } from "expo-sqlite";
import { up as baseline } from "./0001_baseline";

export interface Migration {
  /** The PRAGMA user_version the database is at once this has run. */
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Append only, in version order. A shipped migration is never edited: devices
// that already ran it will not run it again.
export const migrations: readonly Migration[] = [
  { version: 1, name: "baseline", up: baseline },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;
