import type { UserExercise, Set } from "@/store/workoutStore";

// ─── Tuneable constants ───────────────────────────────────────────────────────

export const MAX_VALID_SET_DURATION_SEC = 480; // ignore set durations > 8 min
export const MAX_HISTORY_SAMPLES = 20; // cap on samples used per exercise
export const SUFFICIENT_HISTORY_MIN = 5; // pure P25/P75 from history
export const SPARSE_HISTORY_MIN = 3; // blend 70 % history + 30 % equipment default
export const REP_NORM = 10; // assumed rep count the equipment defaults were calibrated for

// [minSeconds, maxSeconds] per set for each equipment type
export const EQUIPMENT_DURATION_DEFAULTS: Record<string, [number, number]> = {
  barbell: [35, 60],
  "body weight": [20, 40],
  cable: [25, 45],
  dumbbell: [20, 40],
  "elliptical machine": [60, 120],
  "ez barbell": [30, 55],
  kettlebell: [25, 50],
  "leverage machine": [25, 45],
  rope: [20, 40],
  "sled machine": [30, 60],
  "smith machine": [30, 55],
  "stationary bike": [60, 120],
  "stepmill machine": [60, 120],
  "trap bar": [35, 60],
  treadmill: [60, 120],
  "upper body ergometer": [60, 120],
  weighted: [25, 45],
};

export const DEFAULT_FALLBACK_DURATION: [number, number] = [25, 45];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DurationEstimate {
  minSeconds: number;
  maxSeconds: number;
}

export interface SetDurationSample {
  duration: number;
  reps: number | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getEquipmentDefault(
  equipment: string | null | undefined,
): [number, number] {
  if (!equipment) return DEFAULT_FALLBACK_DURATION;
  return (
    EQUIPMENT_DURATION_DEFAULTS[equipment.toLowerCase()] ??
    DEFAULT_FALLBACK_DURATION
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function estimateSetWorkDuration(
  set: Set,
  equipment: string | null | undefined,
  history: SetDurationSample[],
): [number, number] {
  // For timed sets, planned time is the baseline (zero spread); rep scaling skipped.
  // For rep-based sets, use equipment defaults scaled by planned rep count.
  const hasPlannedTime = set.time != null && set.time > 0;
  const [rawDefMin, rawDefMax] = hasPlannedTime
    ? [set.time!, set.time!]
    : getEquipmentDefault(equipment);

  // Rep bounds from the planned set (repsMin → shorter side, repsMax → longer side).
  // Only apply rep scaling to equipment defaults, not to planned times.
  const targetMin = set.repsMin ?? set.repsMax;
  const targetMax = set.repsMax ?? set.repsMin;
  const hasTargetReps =
    targetMin != null && targetMax != null && !hasPlannedTime;

  const defMin = hasTargetReps
    ? Math.round(rawDefMin * (targetMin! / REP_NORM))
    : rawDefMin;
  const defMax = hasTargetReps
    ? Math.round(rawDefMax * (targetMax! / REP_NORM))
    : rawDefMax;

  // Split history into rep-aware samples (reps recorded) and raw samples (legacy).
  const validAll = history
    .filter((h) => h.duration > 0 && h.duration <= MAX_VALID_SET_DURATION_SEC)
    .slice(0, MAX_HISTORY_SAMPLES);

  const repsAware = validAll.filter((h) => h.reps != null && h.reps > 0);

  // Use rep-aware path when we have samples with rep counts AND a target rep range.
  if (repsAware.length > 0 && hasTargetReps) {
    const perRep = repsAware.map((h) => h.duration / h.reps!);
    const n = perRep.length;
    const defMidPerRep = (rawDefMin + rawDefMax) / 2 / REP_NORM;
    const halfSpreadPerRep = (rawDefMax - rawDefMin) / 2 / REP_NORM;
    const histMeanPerRep = perRep.reduce((a, b) => a + b, 0) / n;

    let perRepLo: number;
    let perRepHi: number;

    if (n < SPARSE_HISTORY_MIN) {
      const mid = histMeanPerRep * 0.5 + defMidPerRep * 0.5;
      perRepLo = mid - halfSpreadPerRep * 0.5;
      perRepHi = mid + halfSpreadPerRep * 0.5;
    } else if (n < SUFFICIENT_HISTORY_MIN) {
      const mid = histMeanPerRep * 0.7 + defMidPerRep * 0.3;
      perRepLo = mid - halfSpreadPerRep * 0.4;
      perRepHi = mid + halfSpreadPerRep * 0.4;
    } else {
      const sorted = [...perRep].sort((a, b) => a - b);
      perRepLo = percentile(sorted, 25);
      perRepHi = percentile(sorted, 75);
    }

    return [
      Math.round(perRepLo * targetMin!),
      Math.round(perRepHi * targetMax!),
    ];
  }

  // Fallback: use raw durations (legacy data with null reps, or timed sets).
  const valid = validAll.map((h) => h.duration);
  const n = valid.length;

  if (n === 0) {
    return [defMin, defMax];
  }

  const defMid = (defMin + defMax) / 2;
  const halfSpread = (defMax - defMin) / 2;
  const histMean = valid.reduce((a, b) => a + b, 0) / n;

  if (n < SPARSE_HISTORY_MIN) {
    const mid = histMean * 0.5 + defMid * 0.5;
    return [
      Math.round(mid - halfSpread * 0.5),
      Math.round(mid + halfSpread * 0.5),
    ];
  }

  if (n < SUFFICIENT_HISTORY_MIN) {
    const mid = histMean * 0.7 + defMid * 0.3;
    return [
      Math.round(mid - halfSpread * 0.4),
      Math.round(mid + halfSpread * 0.4),
    ];
  }

  const sorted = [...valid].sort((a, b) => a - b);
  return [
    Math.round(percentile(sorted, 25)),
    Math.round(percentile(sorted, 75)),
  ];
}

// ─── Exported functions ───────────────────────────────────────────────────────

export function computeWorkoutDurationEstimate(
  exercises: UserExercise[],
  historyByExerciseId: Record<number, SetDurationSample[]>,
  countUnilateralDouble = false,
): DurationEstimate {
  // In a superset the transition from exercise A to B has no rest — only B's
  // rest counts (the between-round recovery). Collect the exercise_id of the
  // first exercise encountered in each superset group so we can zero its rest.
  const supersetFirstIds = new Set<number>();
  const seenGroups = new Set<string>();
  for (const ex of exercises) {
    if (ex.supersetGroupId && !seenGroups.has(ex.supersetGroupId)) {
      seenGroups.add(ex.supersetGroupId);
      supersetFirstIds.add(ex.exercise_id);
    }
  }

  let totalMin = 0;
  let totalMax = 0;

  for (const [exIdx, exercise] of exercises.entries()) {
    const history = historyByExerciseId[exercise.exercise_id] ?? [];
    const skipRest = supersetFirstIds.has(exercise.exercise_id);
    for (const [setIdx, set] of exercise.sets.entries()) {
      const hasNextSlot =
        setIdx < exercise.sets.length - 1 ||
        exercises.slice(exIdx + 1).some((e) => e.sets.length > 0);
      const rest =
        skipRest || !hasNextSlot ? 0 : set.restMinutes * 60 + set.restSeconds;
      const [workMin, workMax] = estimateSetWorkDuration(
        set,
        exercise.equipment,
        history,
      );
      const unilateralMul =
        countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
      totalMin += workMin * unilateralMul + rest;
      totalMax += workMax * unilateralMul + rest;
    }
  }

  return { minSeconds: totalMin, maxSeconds: totalMax };
}

function formatMinutes(totalSeconds: number): string {
  const totalMins = Math.ceil(totalSeconds / 60);
  if (totalMins < 60) {
    return `${totalMins} min`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
}

export function formatDurationEstimate(estimate: DurationEstimate): string {
  const minStr = formatMinutes(estimate.minSeconds);
  const maxStr = formatMinutes(estimate.maxSeconds);
  if (minStr === maxStr) {
    return `${minStr}`;
  }
  return `${minStr} – ${maxStr}`;
}

function formatMinutesCompact(totalSeconds: number): string {
  const totalMins = Math.ceil(totalSeconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${String(mins).padStart(2, "0")}`;
}

export function formatDurationEstimateCompact(
  estimate: DurationEstimate,
): string {
  const minStr = formatMinutesCompact(estimate.minSeconds);
  const maxStr = formatMinutesCompact(estimate.maxSeconds);
  if (minStr === maxStr) return minStr;
  return `${minStr}–${maxStr}`;
}
