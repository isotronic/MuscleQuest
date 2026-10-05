import type { SQLiteDatabase } from "expo-sqlite";
import { M_PER_FT, roundCanonical } from "@/utils/units";

// Plan distance targets were stored in whatever unit the user had selected.
// They become canonical metres like every other stored distance. There is no
// record of the unit each target was typed in, so existing values are read
// in the user's current distance unit (the same best guess as the local_date
// backfill). Metres users need no change.
export const up = async (db: SQLiteDatabase): Promise<void> => {
  const setting = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'distanceUnit'`,
  );
  if (setting?.value !== "ft") return;

  const rows = await db.getAllAsync<{ id: number; sets: string | null }>(
    `SELECT id, sets FROM user_workout_exercises WHERE sets LIKE '%"distance"%'`,
  );
  for (const row of rows) {
    let sets: unknown;
    try {
      sets = JSON.parse(row.sets ?? "");
    } catch {
      continue;
    }
    if (!Array.isArray(sets)) continue;

    let changed = false;
    const converted = sets.map((set) => {
      if (
        set &&
        typeof set === "object" &&
        typeof set.distance === "number" &&
        set.distance !== 0
      ) {
        changed = true;
        return { ...set, distance: roundCanonical(set.distance * M_PER_FT) };
      }
      return set;
    });
    if (!changed) continue;

    await db.runAsync(
      `UPDATE user_workout_exercises SET sets = ? WHERE id = ?`,
      [JSON.stringify(converted), row.id],
    );
  }
};
