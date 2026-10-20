import type { SQLiteDatabase } from "expo-sqlite";

// Volume looks up the body weight logged on or before each workout
// (bodyWeightAtSql), once per workout. Without an index each lookup scans
// every weight entry.
export const up = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_body_measurements_date ON body_measurements(date);`,
  );
};
