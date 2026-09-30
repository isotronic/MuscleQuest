import type { SQLiteDatabase } from "expo-sqlite";
import { parseDbTimestamp, toLocalDateKey } from "@/utils/dates";

// Runs on every boot, after migrations. It is a repair rather than a
// migration because rows can lose their local_date again after the schema is
// current, see below.
export async function repairLocalDates(db: SQLiteDatabase): Promise<void> {
  // Backfill local_date on rows written before the column existed, and
  // normalise their date_completed / recorded_at to ISO with an explicit Z
  // so every reader parses the same instant. Both are computed in JS by the
  // single authority in utils/dates.ts rather than in SQL.
  //
  // This assumes the user was in their current timezone when they trained.
  // That is right for almost everyone, and no better answer exists: the
  // original offset was never recorded.
  //
  // The first run covers every row. After that, only rows still missing a
  // local_date: an OTA rollback to an older bundle, or a restored backup
  // taken on one, writes them after the flag is already set.
  const localDateBackfillDone = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'local_date_backfill_v1'`,
  );
  const onlyMissing = localDateBackfillDone ? " AND local_date IS NULL" : "";
  const staleWorkouts = await db.getAllAsync<{
    id: number;
    date_completed: string;
  }>(
    `SELECT id, date_completed FROM completed_workouts WHERE date_completed IS NOT NULL${onlyMissing}`,
  );
  const staleEntries = await db.getAllAsync<{
    id: number;
    recorded_at: string;
  }>(
    `SELECT id, recorded_at FROM body_measurement_entries WHERE recorded_at IS NOT NULL${onlyMissing}`,
  );
  // body_measurements is the legacy weight table. Entries are linked to its
  // rows by an exact date match (update and delete rely on it), so whatever
  // rewrites an entry's recorded_at must rewrite the matching date the same
  // way. Normalising every non-ISO date with the same function keeps pairs
  // equal.
  const staleLegacyWeights = await db.getAllAsync<{
    id: number;
    date: string;
  }>(
    `SELECT id, date FROM body_measurements WHERE date IS NOT NULL AND date NOT LIKE '%Z'`,
  );
  if (
    !localDateBackfillDone ||
    staleWorkouts.length > 0 ||
    staleEntries.length > 0 ||
    staleLegacyWeights.length > 0
  ) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const row of staleWorkouts) {
        const instant = parseDbTimestamp(row.date_completed);
        if (isNaN(instant.getTime())) continue;
        await txn.runAsync(
          `UPDATE completed_workouts SET date_completed = ?, local_date = ? WHERE id = ?`,
          [instant.toISOString(), toLocalDateKey(instant), row.id],
        );
      }
      for (const row of staleEntries) {
        const instant = parseDbTimestamp(row.recorded_at);
        if (isNaN(instant.getTime())) continue;
        await txn.runAsync(
          `UPDATE body_measurement_entries SET recorded_at = ?, local_date = ? WHERE id = ?`,
          [instant.toISOString(), toLocalDateKey(instant), row.id],
        );
      }
      for (const row of staleLegacyWeights) {
        const instant = parseDbTimestamp(row.date);
        if (isNaN(instant.getTime())) continue;
        await txn.runAsync(
          `UPDATE body_measurements SET date = ? WHERE id = ?`,
          [instant.toISOString(), row.id],
        );
      }
      if (!localDateBackfillDone) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO settings (key, value) VALUES ('local_date_backfill_v1', 'true')`,
        );
      }
    });
  }
}
