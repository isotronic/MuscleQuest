// Body weight in kg at a given UTC instant: the latest weight logged on or
// before it, else the body weight setting (which mirrors the latest entry).
// NULL when no weight was ever logged. Reads body_measurements, which
// utils/db/measurements.ts keeps in step with every weight entry.
export const bodyWeightAtSql = (instantExpr: string) => `COALESCE(
  (SELECT bm.body_weight FROM body_measurements bm
   WHERE bm.body_weight IS NOT NULL AND bm.date <= ${instantExpr}
   ORDER BY bm.date DESC LIMIT 1),
  CAST((SELECT s.value FROM settings s WHERE s.key = 'bodyWeight') AS REAL)
)`;

// Every workout's body weight at the time, computed once per workout so a
// query over its sets does not repeat the lookup per row. Join it on
// workout_body_weight.completed_workout_id.
export const WORKOUT_BODY_WEIGHT_CTE = `workout_body_weight AS MATERIALIZED (
  SELECT w.id AS completed_workout_id,
    ${bodyWeightAtSql("w.date_completed")} AS body_weight_kg
  FROM completed_workouts w
  WHERE w.is_deleted = FALSE
)`;
