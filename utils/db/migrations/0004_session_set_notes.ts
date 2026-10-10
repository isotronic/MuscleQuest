import type { SQLiteDatabase } from "expo-sqlite";

// Free-text notes on a finished session and on individual sets. They stay on
// the device (and in backups and the data export); sharing never selects them.
export const up = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(
    `ALTER TABLE completed_workouts ADD COLUMN notes TEXT DEFAULT NULL;`,
  );
  await db.execAsync(
    `ALTER TABLE completed_sets ADD COLUMN note TEXT DEFAULT NULL;`,
  );
};
