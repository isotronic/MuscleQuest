// The per-set number personal records are judged by: estimated 1RM (Epley)
// for weight and assisted sets, else reps, seconds or metres. Paired-weight
// exercises always count both weights, so a PR does not move when the stats
// doubling setting changes. Expects `e` (exercises) and `cs`
// (completed_sets) in scope.
export const progressionMetricSql = (trackingTypeExpr = "e.tracking_type") =>
  `CASE ${trackingTypeExpr}
    WHEN 'weight' THEN (COALESCE(cs.weight, 0) * CASE WHEN e.double_weight = 1 THEN 2 ELSE 1 END) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
    WHEN 'assisted' THEN (CAST((SELECT value FROM settings WHERE key = 'bodyWeight') AS REAL) - COALESCE(cs.weight, 0)) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
    WHEN 'reps' THEN CAST(COALESCE(cs.reps, 0) AS REAL)
    WHEN 'time' THEN CAST(COALESCE(cs.time, 0) AS REAL)
    WHEN 'distance' THEN CAST(COALESCE(cs.distance, 0) AS REAL)
    ELSE (COALESCE(cs.weight, 0) * CASE WHEN e.double_weight = 1 THEN 2 ELSE 1 END) * (1.0 + COALESCE(cs.reps, 0) / 30.0)
  END`;
