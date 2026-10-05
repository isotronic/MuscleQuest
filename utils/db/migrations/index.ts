import type { SQLiteDatabase } from "expo-sqlite";
import { up as baseline } from "./0001_baseline";
import { up as exerciseImageUri } from "./0002_exercise_image_uri";
import { up as planDistanceMetres } from "./0003_plan_distance_metres";

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
  { version: 2, name: "exercise_image_uri", up: exerciseImageUri },
  { version: 3, name: "plan_distance_metres", up: planDistanceMetres },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;
