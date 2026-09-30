import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import {
  toDisplayValue,
  type ValueKind,
  type MeasurementDisplayOptions,
} from "@/utils/measurementConversions";
import { nowForDb, parseDbTimestamp, toLocalDateKey } from "@/utils/dates";
import { openDatabase } from "./connection";

export interface BodyMetricDefinition {
  id: number;
  key: string;
  label: string;
  value_kind: ValueKind;
  is_builtin: boolean;
  is_active: boolean;
  is_deleted: boolean;
  sort_order: number;
}

export interface BodyMeasurementEntry {
  id: number;
  recorded_at: string;
}

export interface BodyMeasurementSession {
  entry: BodyMeasurementEntry;
  values: {
    metric: BodyMetricDefinition;
    canonicalValue: number;
    displayValue: number;
    displayUnit: string;
  }[];
}

type RawMetricDefinitionRow = {
  id: number;
  key: string;
  label: string;
  value_kind: string;
  is_builtin: number;
  is_active: number;
  is_deleted: number;
  sort_order: number;
};

function rowToMetricDefinition(
  row: RawMetricDefinitionRow,
): BodyMetricDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value_kind: row.value_kind as ValueKind,
    is_builtin: row.is_builtin === 1,
    is_active: row.is_active === 1,
    is_deleted: row.is_deleted === 1,
    sort_order: row.sort_order,
  };
}

export const fetchActiveBodyMetricDefinitions = async (): Promise<
  BodyMetricDefinition[]
> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = (await db.getAllAsync(
      `SELECT * FROM body_metric_definitions
       WHERE is_active = 1 AND is_deleted = 0
       ORDER BY sort_order ASC`,
    )) as RawMetricDefinitionRow[];
    return rows.map(rowToMetricDefinition);
  } catch (error: any) {
    console.error("Error fetching active body metric definitions:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const fetchAllBodyMetricDefinitions = async (): Promise<
  BodyMetricDefinition[]
> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = (await db.getAllAsync(
      `SELECT * FROM body_metric_definitions
       WHERE is_deleted = 0
       ORDER BY is_builtin DESC, sort_order ASC`,
    )) as RawMetricDefinitionRow[];
    return rows.map(rowToMetricDefinition);
  } catch (error: any) {
    console.error("Error fetching all body metric definitions:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const insertCustomBodyMetricDefinition = async (
  label: string,
  value_kind: ValueKind,
): Promise<number> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const key =
      label.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "") +
      "_" +
      Date.now();
    const maxOrderRow = await db.getFirstAsync<{ max_order: number | null }>(
      `SELECT MAX(sort_order) AS max_order FROM body_metric_definitions WHERE is_deleted = 0`,
    );
    const sortOrder = (maxOrderRow?.max_order ?? 11) + 1;
    const result = await db.runAsync(
      `INSERT INTO body_metric_definitions (key, label, value_kind, is_builtin, is_active, is_deleted, sort_order)
       VALUES (?, ?, ?, 0, 1, 0, ?)`,
      [key, label, value_kind, sortOrder],
    );
    return result.lastInsertRowId;
  } catch (error: any) {
    console.error("Error inserting custom body metric definition:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const toggleBodyMetricActive = async (
  id: number,
  is_active: boolean,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE body_metric_definitions SET is_active = ? WHERE id = ?`,
      [is_active ? 1 : 0, id],
    );
  } catch (error: any) {
    console.error("Error toggling body metric active state:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const softDeleteCustomBodyMetricDefinition = async (
  id: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE body_metric_definitions SET is_deleted = 1, is_active = 0 WHERE id = ? AND is_builtin = 0`,
      [id],
    );
  } catch (error: any) {
    console.error("Error soft-deleting body metric definition:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const fetchBodyMeasurementSessions = async (
  options: MeasurementDisplayOptions,
  limit?: number,
): Promise<BodyMeasurementSession[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const limitClause = limit !== undefined ? "LIMIT ?" : "";
    const params = limit !== undefined ? [limit] : [];
    const rows = (await db.getAllAsync(
      `SELECT
         bme.id          AS entry_id,
         bme.recorded_at,
         bmd.id,
         bmd.key,
         bmd.label,
         bmd.value_kind,
         bmd.is_builtin,
         bmd.is_active,
         bmd.is_deleted,
         bmd.sort_order,
         bmv.value
       FROM (
         SELECT id, recorded_at FROM body_measurement_entries
         ORDER BY recorded_at DESC
         ${limitClause}
       ) bme
       JOIN body_measurement_values bmv ON bmv.entry_id = bme.id
       JOIN body_metric_definitions bmd ON bmd.id = bmv.metric_id
       ORDER BY bme.recorded_at DESC, bmd.sort_order ASC`,
      params,
    )) as (RawMetricDefinitionRow & {
      entry_id: number;
      recorded_at: string;
      value: number;
    })[];

    const sessionMap = new Map<number, BodyMeasurementSession>();
    for (const row of rows) {
      if (!sessionMap.has(row.entry_id)) {
        sessionMap.set(row.entry_id, {
          entry: { id: row.entry_id, recorded_at: row.recorded_at },
          values: [],
        });
      }
      const metric = rowToMetricDefinition(row);
      const { displayValue, displayUnit } = toDisplayValue(
        row.value,
        metric.value_kind,
        options,
      );
      sessionMap.get(row.entry_id)!.values.push({
        metric,
        canonicalValue: row.value,
        displayValue,
        displayUnit,
      });
    }
    return Array.from(sessionMap.values());
  } catch (error: any) {
    console.error("Error fetching body measurement sessions:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface LatestBodyMetricValue {
  metric: BodyMetricDefinition;
  canonicalValue: number;
  displayValue: number;
  displayUnit: string;
  recorded_at: string;
}

/**
 * The most recent reading for every metric, one row each.
 *
 * The home-screen card and its log sheet need each metric's latest value, which
 * a "last N sessions" query cannot guarantee: a metric logged rarely falls out
 * of the window as soon as N more entries are recorded for anything else.
 *
 * Includes inactive-but-not-deleted metrics so callers can tell "no history at
 * all" apart from "history exists, but only for metrics now switched off".
 */
export const fetchLatestBodyMetricValues = async (
  options: MeasurementDisplayOptions,
): Promise<LatestBodyMetricValue[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    // Keep only the row that nothing else beats: no later recorded_at, and for
    // an exact tie, no higher entry id. Backdated entries are stored at a fixed
    // noon timestamp, so the same metric really can hold two readings with
    // identical recorded_at; the later entry is the correction and must win.
    //
    // Selecting the row directly rather than grouping also means every column
    // comes from that row, with no reliance on SQLite's bare-column extension.
    const rows = (await db.getAllAsync(
      `SELECT
         bmd.id,
         bmd.key,
         bmd.label,
         bmd.value_kind,
         bmd.is_builtin,
         bmd.is_active,
         bmd.is_deleted,
         bmd.sort_order,
         bmv.value,
         bme.recorded_at
       FROM body_metric_definitions bmd
       JOIN body_measurement_values bmv  ON bmv.metric_id = bmd.id
       JOIN body_measurement_entries bme ON bme.id = bmv.entry_id
       WHERE bmd.is_deleted = 0
         AND NOT EXISTS (
           SELECT 1
           FROM body_measurement_values v2
           JOIN body_measurement_entries e2 ON e2.id = v2.entry_id
           WHERE v2.metric_id = bmd.id
             AND (
               e2.recorded_at > bme.recorded_at
               OR (e2.recorded_at = bme.recorded_at AND e2.id > bme.id)
             )
         )
       ORDER BY bmd.sort_order ASC`,
    )) as (RawMetricDefinitionRow & {
      value: number;
      recorded_at: string;
    })[];

    return rows.map((row) => {
      const metric = rowToMetricDefinition(row);
      const { displayValue, displayUnit } = toDisplayValue(
        row.value,
        metric.value_kind,
        options,
      );
      return {
        metric,
        canonicalValue: row.value,
        displayValue,
        displayUnit,
        recorded_at: row.recorded_at,
      };
    });
  } catch (error: any) {
    console.error("Error fetching latest body metric values:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const fetchBodyMeasurementSessionsForChart = async (
  metricId: number,
  options: MeasurementDisplayOptions,
): Promise<
  { recorded_at: string; local_date: string | null; displayValue: number }[]
> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const metricRow = await db.getFirstAsync<RawMetricDefinitionRow>(
      `SELECT * FROM body_metric_definitions WHERE id = ?`,
      [metricId],
    );
    if (!metricRow) return [];
    const metric = rowToMetricDefinition(metricRow);
    const rows = (await db.getAllAsync(
      `SELECT bme.recorded_at, bme.local_date, bmv.value
       FROM body_measurement_values bmv
       JOIN body_measurement_entries bme ON bme.id = bmv.entry_id
       WHERE bmv.metric_id = ?
       ORDER BY bme.recorded_at ASC`,
      [metricId],
    )) as { recorded_at: string; local_date: string | null; value: number }[];
    return rows.map((row) => ({
      recorded_at: row.recorded_at,
      local_date: row.local_date,
      displayValue: toDisplayValue(row.value, metric.value_kind, options)
        .displayValue,
    }));
  } catch (error: any) {
    console.error("Error fetching body measurement sessions for chart:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const insertBodyMeasurementSession = async (
  recorded_at: string,
  values: { metric_id: number; value: number }[],
): Promise<number> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    let entryId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        `INSERT INTO body_measurement_entries (recorded_at, local_date) VALUES (?, ?)`,
        [recorded_at, toLocalDateKey(parseDbTimestamp(recorded_at))],
      );
      entryId = result.lastInsertRowId;
      for (const v of values) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
          [entryId, v.metric_id, v.value],
        );
      }
      if (weightMetric) {
        const weightValue = values.find((v) => v.metric_id === weightMetric.id);
        if (weightValue) {
          await txn.runAsync(
            `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
            [recorded_at, weightValue.value],
          );
          // Recompute settings.bodyWeight from the latest remaining weight so
          // inserting a past-dated entry doesn't overwrite a newer one.
          const latestWeight = await txn.getFirstAsync<{ body_weight: number }>(
            `SELECT body_weight FROM body_measurements
             WHERE body_weight IS NOT NULL
             ORDER BY date DESC LIMIT 1`,
          );
          if (latestWeight) {
            await txn.runAsync(
              `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
              [latestWeight.body_weight.toString()],
            );
          }
        }
      }
    });
    return entryId;
  } catch (error: any) {
    console.error("Error inserting body measurement session:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const updateBodyMeasurementSession = async (
  entry_id: number,
  values: { metric_id: number; value: number }[],
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (values.length === 0) {
        await txn.runAsync(
          `DELETE FROM body_measurement_values WHERE entry_id = ?`,
          [entry_id],
        );
      } else {
        const placeholders = values.map(() => "?").join(", ");
        await txn.runAsync(
          `DELETE FROM body_measurement_values WHERE entry_id = ? AND metric_id NOT IN (${placeholders})`,
          [entry_id, ...values.map((v) => v.metric_id)],
        );
      }
      for (const v of values) {
        await txn.runAsync(
          `INSERT OR REPLACE INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
          [entry_id, v.metric_id, v.value],
        );
      }
      // Mirror weight changes to legacy tables
      if (weightMetric) {
        const weightValue = values.find((v) => v.metric_id === weightMetric.id);
        const entry = await txn.getFirstAsync<{ recorded_at: string }>(
          `SELECT recorded_at FROM body_measurement_entries WHERE id = ?`,
          [entry_id],
        );
        if (entry) {
          if (weightValue) {
            const updateResult = await txn.runAsync(
              `UPDATE body_measurements SET body_weight = ? WHERE date = ?`,
              [weightValue.value, entry.recorded_at],
            );
            if (updateResult.changes === 0) {
              await txn.runAsync(
                `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
                [entry.recorded_at, weightValue.value],
              );
            }
          } else {
            // Weight metric was removed from this entry — NULL out legacy row
            await txn.runAsync(
              `UPDATE body_measurements SET body_weight = NULL WHERE date = ?`,
              [entry.recorded_at],
            );
          }
          // Recompute settings.bodyWeight from the latest remaining weight
          const latestWeight = await txn.getFirstAsync<{ body_weight: number }>(
            `SELECT body_weight FROM body_measurements
             WHERE body_weight IS NOT NULL
             ORDER BY date DESC LIMIT 1`,
          );
          if (latestWeight) {
            await txn.runAsync(
              `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
              [latestWeight.body_weight.toString()],
            );
          } else {
            await txn.runAsync(`DELETE FROM settings WHERE key = 'bodyWeight'`);
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Error updating body measurement session:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const deleteBodyMeasurementSession = async (
  entry_id: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Read the entry's timestamp and weight value before deleting
      const entry = await txn.getFirstAsync<{
        recorded_at: string;
        weight: number | null;
      }>(
        `SELECT e.recorded_at, v.value AS weight
         FROM body_measurement_entries e
         LEFT JOIN body_measurement_values v
           ON v.entry_id = e.id AND v.metric_id = ?
         WHERE e.id = ?`,
        [weightMetric?.id ?? -1, entry_id],
      );
      await txn.runAsync(
        `DELETE FROM body_measurement_values WHERE entry_id = ?`,
        [entry_id],
      );
      await txn.runAsync(`DELETE FROM body_measurement_entries WHERE id = ?`, [
        entry_id,
      ]);
      if (entry) {
        await txn.runAsync(`DELETE FROM body_measurements WHERE date = ?`, [
          entry.recorded_at,
        ]);
        if (entry.weight !== null) {
          const currentSetting = await txn.getFirstAsync<{ value: string }>(
            `SELECT value FROM settings WHERE key = 'bodyWeight'`,
          );
          if (
            currentSetting &&
            Math.abs(parseFloat(currentSetting.value) - entry.weight) < 0.001
          ) {
            const nextWeight = await txn.getFirstAsync<{
              body_weight: number;
            }>(
              `SELECT body_weight FROM body_measurements
               WHERE body_weight IS NOT NULL
               ORDER BY date DESC LIMIT 1`,
            );
            if (nextWeight) {
              await txn.runAsync(
                `INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', ?)`,
                [nextWeight.body_weight.toString()],
              );
            } else {
              await txn.runAsync(
                `DELETE FROM settings WHERE key = 'bodyWeight'`,
              );
            }
          }
        }
      }
    });
  } catch (error: any) {
    console.error("Error deleting body measurement session:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const saveBodyWeightMeasurement = async (
  weightKg: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const { utc: now, localDate } = nowForDb();
    // Legacy table — keeps useExerciseHistoryQuery.ts working unchanged
    await db.runAsync(
      `INSERT INTO body_measurements (date, body_weight) VALUES (?, ?)`,
      [now, weightKg],
    );
    // New measurement tables
    const weightMetric = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM body_metric_definitions WHERE key = 'weight'`,
    );
    if (weightMetric) {
      const result = await db.runAsync(
        `INSERT INTO body_measurement_entries (recorded_at, local_date) VALUES (?, ?)`,
        [now, localDate],
      );
      await db.runAsync(
        `INSERT INTO body_measurement_values (entry_id, metric_id, value) VALUES (?, ?, ?)`,
        [result.lastInsertRowId, weightMetric.id, weightKg],
      );
    }
  } catch (error: any) {
    console.error("Error saving body weight measurement:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};
