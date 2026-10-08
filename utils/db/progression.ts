import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import {
  ExerciseFeedback,
  ExerciseFeedbackPayload,
  ExerciseProgressionState,
  ProgressionAction,
  ProgressionRuleResult,
  RecoveryRating,
  UserProgressionIncrements,
} from "@/types/progression";
import { computeLayoffReduction } from "@/utils/progressionEngine";
import { openDatabase } from "./connection";

// The session progression is measured against: the latest logged session of
// this exercise in this plan workout, skipping deleted and deload sessions
// (live feedback is off during deload weeks too). Returns the
// completed_exercises id, or NULL when there is none.
const baselineSessionSql = (workoutId: string, exerciseId: string) => `(
  SELECT ce.id
  FROM completed_exercises ce
  JOIN completed_workouts cw ON cw.id = ce.completed_workout_id
  WHERE cw.workout_id = ${workoutId} AND ce.exercise_id = ${exerciseId}
    AND cw.is_deleted = 0 AND ce.is_deleted = 0
    AND cw.is_deload = 0
  ORDER BY cw.date_completed DESC, cw.id DESC
  LIMIT 1
)`;

const WORKING_SET_SQL =
  "cs.is_deleted = 0 AND cs.is_warmup = 0 AND cs.is_drop_set = 0";

// Heaviest working set of the baseline session, correlated on `uwe` and `e`.
const RECENT_WEIGHT_SQL = `(
  SELECT MAX(cs.weight)
  FROM completed_sets cs
  WHERE cs.completed_exercise_id = ${baselineSessionSql("uwe.workout_id", "e.exercise_id")}
    AND ${WORKING_SET_SQL}
    AND cs.weight IS NOT NULL
) AS recent_weight`;

export interface ProgressionSettings {
  enabled: boolean;
  increments: UserProgressionIncrements;
}

export const getProgressionSettings =
  async (): Promise<ProgressionSettings> => {
    let db: SQLite.SQLiteDatabase | undefined;
    try {
      db = await openDatabase("userData.db");
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN (
        'adaptive_progression_enabled',
        'progression_increment_barbell_kg',
        'progression_increment_dumbbell_kg',
        'progression_increment_cable_kg',
        'progression_increment_machine_kg'
      )`,
      );
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      return {
        enabled: map["adaptive_progression_enabled"] === "1",
        increments: {
          barbellKg: parseFloat(
            map["progression_increment_barbell_kg"] ?? "2.5",
          ),
          dumbbellKg: parseFloat(
            map["progression_increment_dumbbell_kg"] ?? "2.0",
          ),
          cableKg: parseFloat(map["progression_increment_cable_kg"] ?? "2.5"),
          machineKg: parseFloat(
            map["progression_increment_machine_kg"] ?? "2.5",
          ),
        },
      };
    } catch (error: any) {
      console.error("Error fetching progression settings:", error);
      notifyBugsnag(error);
      throw error;
    } finally {
      if (db) await db.closeAsync();
    }
  };

export const setProgressionSetting = async (
  key: string,
  value: string,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  } catch (error: any) {
    console.error("Error setting progression setting:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const getDeloadWeek = async (planId: number): Promise<string | null> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [`plan_${planId}_deload_week`],
    );
    return row?.value ?? null;
  } catch (error: any) {
    console.error("Error fetching deload week:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const setDeloadWeek = async (
  planId: number,
  isoWeek: string | null,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const key = `plan_${planId}_deload_week`;
    if (isoWeek === null) {
      await db.runAsync(`DELETE FROM settings WHERE key = ?`, [key]);
    } else {
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [key, isoWeek],
      );
    }
  } catch (error: any) {
    console.error("Error setting deload week:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const getMaxWorkingWeightForCompletedExercise = async (
  completedExerciseId: number,
): Promise<number | null> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{ weight: number }>(
      `SELECT MAX(weight) AS weight
       FROM completed_sets
       WHERE completed_exercise_id = ?
         AND is_warmup = 0
         AND weight IS NOT NULL`,
      [completedExerciseId],
    );
    return row?.weight ?? null;
  } catch (error: any) {
    console.error("Error fetching max working weight:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const insertExerciseFeedback = async (
  payload: ExerciseFeedbackPayload,
): Promise<number> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const result = await db.runAsync(
      `INSERT INTO exercise_feedback (
        user_workout_exercise_id, effort_rating, pain_flag,
        progression_intent, performance_ratio, notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.userWorkoutExerciseId,
        payload.effortRating,
        payload.painFlag,
        payload.progressionIntent ?? null,
        payload.performanceRatio,
        payload.notes ?? null,
      ],
    );
    return result.lastInsertRowId;
  } catch (error: any) {
    console.error("Error inserting exercise feedback:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const getRecentExerciseFeedback = async (
  userWorkoutExerciseId: number,
  limit: number = 3,
): Promise<ExerciseFeedback[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      id: number;
      effort_rating: string;
      pain_flag: string;
      progression_intent: string | null;
      performance_ratio: number;
      created_at: string;
    }>(
      `SELECT id, effort_rating, pain_flag, progression_intent, performance_ratio, created_at
       FROM exercise_feedback
       WHERE user_workout_exercise_id = ? AND is_deleted = 0
       ORDER BY created_at DESC
       LIMIT ?`,
      [userWorkoutExerciseId, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      effortRating: row.effort_rating as ExerciseFeedback["effortRating"],
      painFlag: row.pain_flag as ExerciseFeedback["painFlag"],
      progressionIntent:
        (row.progression_intent as ExerciseFeedback["progressionIntent"]) ??
        undefined,
      performanceRatio: row.performance_ratio,
      createdAt: row.created_at,
    }));
  } catch (error: any) {
    console.error("Error fetching exercise feedback:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface UpsertProgressionExtras {
  discomfortStreakCount: number;
  consecutiveHoldCount: number;
  plateauAdvisory: boolean;
  lastProgressionAt: string | null;
}

export const upsertProgressionState = async (
  userWorkoutExerciseId: number,
  result: ProgressionRuleResult,
  sourceFeedbackId: number,
  consecutiveDirectionCount: number,
  extras: UpsertProgressionExtras,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `INSERT INTO exercise_progression_state (
        user_workout_exercise_id, suggestion_action, suggested_weight,
        suggested_reps_per_set, suggested_sets,
        rule_key, rule_explanation, source_feedback_id,
        consecutive_direction_count, is_applied, is_dismissed,
        discomfort_streak_count, consecutive_hold_count, plateau_advisory,
        last_progression_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_workout_exercise_id) DO UPDATE SET
        suggestion_action = excluded.suggestion_action,
        suggested_weight = excluded.suggested_weight,
        suggested_reps_per_set = excluded.suggested_reps_per_set,
        suggested_sets = excluded.suggested_sets,
        rule_key = excluded.rule_key,
        rule_explanation = excluded.rule_explanation,
        source_feedback_id = excluded.source_feedback_id,
        consecutive_direction_count = excluded.consecutive_direction_count,
        is_applied = 0,
        is_dismissed = 0,
        recovery_rating = NULL,
        recovery_checked_at = NULL,
        discomfort_streak_count = excluded.discomfort_streak_count,
        consecutive_hold_count = excluded.consecutive_hold_count,
        plateau_advisory = excluded.plateau_advisory,
        last_progression_at = excluded.last_progression_at,
        updated_at = datetime('now')`,
      [
        userWorkoutExerciseId,
        result.action,
        result.suggestedWeight ?? null,
        result.suggestedRepsPerSet != null
          ? JSON.stringify(result.suggestedRepsPerSet)
          : null,
        result.suggestedSets ?? null,
        result.ruleKey,
        result.explanation,
        sourceFeedbackId,
        consecutiveDirectionCount,
        extras.discomfortStreakCount,
        extras.consecutiveHoldCount,
        extras.plateauAdvisory ? 1 : 0,
        extras.lastProgressionAt,
      ],
    );
  } catch (error: any) {
    console.error("Error upserting progression state:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const getProgressionState = async (
  userWorkoutExerciseId: number,
  skipLayoffOverride = false,
): Promise<ExerciseProgressionState | null> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{
      id: number;
      user_workout_exercise_id: number;
      suggestion_action: string;
      suggested_weight: number | null;
      suggested_reps_per_set: string | null;
      suggested_sets: number | null;
      rule_key: string;
      rule_explanation: string;
      source_feedback_id: number | null;
      recovery_rating: string | null;
      recovery_checked_at: string | null;
      consecutive_direction_count: number;
      discomfort_streak_count: number;
      consecutive_hold_count: number;
      plateau_advisory: number;
      last_progression_at: string | null;
      is_applied: number;
      is_dismissed: number;
      created_at: string;
      updated_at: string;
      target_muscle: string;
      equipment: string;
      tracking_type_override: string | null;
      tracking_type: string | null;
      recent_weight: number | null;
    }>(
      `SELECT
        eps.id,
        eps.user_workout_exercise_id,
        eps.suggestion_action,
        eps.suggested_weight,
        eps.suggested_reps_per_set,
        eps.suggested_sets,
        eps.rule_key,
        eps.rule_explanation,
        eps.source_feedback_id,
        eps.recovery_rating,
        eps.recovery_checked_at,
        eps.consecutive_direction_count,
        eps.discomfort_streak_count,
        eps.consecutive_hold_count,
        eps.plateau_advisory,
        eps.last_progression_at,
        eps.is_applied,
        eps.is_dismissed,
        eps.created_at,
        eps.updated_at,
        e.target_muscle,
        e.equipment,
        uwe.tracking_type_override,
        e.tracking_type,
        ${RECENT_WEIGHT_SQL}
      FROM exercise_progression_state eps
      JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
      JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE eps.user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
    if (!row) return null;
    let parsedRepsPerSet: number[] | undefined;
    if (row.suggested_reps_per_set) {
      try {
        parsedRepsPerSet = JSON.parse(row.suggested_reps_per_set);
      } catch {
        parsedRepsPerSet = undefined;
      }
    }
    const base: ExerciseProgressionState = {
      id: row.id,
      userWorkoutExerciseId: row.user_workout_exercise_id,
      suggestionAction: row.suggestion_action as ProgressionAction,
      suggestedWeight: row.suggested_weight ?? undefined,
      suggestedRepsPerSet: parsedRepsPerSet,
      suggestedSets: row.suggested_sets ?? undefined,
      ruleKey: row.rule_key,
      ruleExplanation: row.rule_explanation,
      sourceFeedbackId: row.source_feedback_id ?? undefined,
      recoveryRating: (row.recovery_rating as RecoveryRating) ?? undefined,
      recoveryCheckedAt: row.recovery_checked_at ?? undefined,
      consecutiveDirectionCount: row.consecutive_direction_count,
      discomfortStreakCount: row.discomfort_streak_count ?? 0,
      consecutiveHoldCount: row.consecutive_hold_count ?? 0,
      plateauAdvisory: row.plateau_advisory === 1,
      lastProgressionAt: row.last_progression_at ?? undefined,
      isApplied: row.is_applied === 1,
      isDismissed: row.is_dismissed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (skipLayoffOverride) return base;

    const trackingType =
      row.tracking_type_override ?? row.tracking_type ?? "weight";
    if (
      (trackingType !== "weight" && trackingType !== "assisted") ||
      row.recent_weight == null
    ) {
      return base;
    }

    const daysByMuscle = await getDaysSinceLastWorkoutByMuscle();
    const days = daysByMuscle[row.target_muscle];
    if (days == null) return base;

    const settings = await getProgressionSettings();
    const layoff = computeLayoffReduction(
      days,
      row.recent_weight,
      row.equipment,
      settings.increments,
    );
    if (!layoff) return base;

    return {
      ...base,
      suggestionAction: "reduce_load",
      suggestedWeight: layoff.suggestedWeight,
      suggestedRepsPerSet: undefined,
      ruleKey: "MUSCLE_LAYOFF",
      ruleExplanation: `It's been ${days} days since you trained ${row.target_muscle}. We've suggested a lighter weight to help you ease back in safely.`,
    };
  } catch (error: any) {
    console.error("Error fetching progression state:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const updateProgressionStateRecovery = async (
  userWorkoutExerciseId: number,
  recoveryRating: RecoveryRating,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state
       SET recovery_rating = ?, recovery_checked_at = datetime('now'), updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [recoveryRating, userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error updating recovery rating:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const applyProgressionToExercise = async (
  userWorkoutExerciseId: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state SET is_applied = 1, updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error applying progression to exercise:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const dismissProgressionState = async (
  userWorkoutExerciseId: number,
): Promise<void> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.runAsync(
      `UPDATE exercise_progression_state
       SET is_dismissed = 1, updated_at = datetime('now')
       WHERE user_workout_exercise_id = ?`,
      [userWorkoutExerciseId],
    );
  } catch (error: any) {
    console.error("Error dismissing progression state:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

interface PendingRecoveryRow {
  userWorkoutExerciseId: number;
  exerciseId: number;
  targetMuscle: string;
}

export const getPendingRecoveryCheckIns = async (
  workoutId: number,
): Promise<PendingRecoveryRow[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      user_workout_exercise_id: number;
      exercise_id: number;
      target_muscle: string;
    }>(
      `SELECT eps.user_workout_exercise_id, uwe.exercise_id, e.target_muscle
       FROM exercise_progression_state eps
       JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
       JOIN exercises e ON e.exercise_id = uwe.exercise_id
       JOIN exercise_feedback ef ON ef.id = eps.source_feedback_id
       WHERE uwe.workout_id = ?
         AND uwe.is_deleted = 0
         AND eps.recovery_rating IS NULL
         AND eps.is_dismissed = 0
         AND (julianday('now') - julianday(ef.created_at)) * 24 > 12`,
      [workoutId],
    );
    return rows.map((row) => ({
      userWorkoutExerciseId: row.user_workout_exercise_id,
      exerciseId: row.exercise_id,
      targetMuscle: row.target_muscle,
    }));
  } catch (error: any) {
    console.error("Error fetching pending recovery check-ins:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const getDaysSinceLastWorkoutByMuscle = async (): Promise<
  Record<string, number>
> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      target_muscle: string;
      days_since: number;
    }>(
      `SELECT
        e.target_muscle AS target_muscle,
        CAST((julianday('now') - julianday(MAX(cw.date_completed))) AS INTEGER) AS days_since
       FROM completed_exercises ce
       JOIN completed_workouts cw ON cw.id = ce.completed_workout_id
       JOIN exercises e ON e.exercise_id = ce.exercise_id
       WHERE ce.is_deleted = 0 AND cw.is_deleted = 0
       GROUP BY e.target_muscle`,
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.target_muscle] = row.days_since;
    }
    return result;
  } catch (error: any) {
    console.error("Error fetching days since last workout by muscle:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface ExerciseProgressionContext {
  exerciseId: number;
  trackingType: string;
  equipment: string;
  currentSets: import("@/store/workoutStore").Set[];
  recentWorkingWeight: number | null;
  latestFeedback: ExerciseFeedback | null;
  consecutiveDirectionCount: number;
  discomfortStreakCount: number;
}

export const getExerciseProgressionContext = async (
  userWorkoutExerciseId: number,
): Promise<ExerciseProgressionContext | null> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const row = await db.getFirstAsync<{
      exercise_id: number;
      sets: string | null;
      tracking_type_override: string | null;
      tracking_type: string | null;
      equipment: string;
      recent_weight: number | null;
    }>(
      `SELECT
        e.exercise_id,
        uwe.sets,
        uwe.tracking_type_override,
        e.tracking_type,
        e.equipment,
        ${RECENT_WEIGHT_SQL}
      FROM user_workout_exercises uwe
      JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE uwe.id = ?`,
      [userWorkoutExerciseId],
    );
    if (!row) return null;

    let currentSets: import("@/store/workoutStore").Set[] = [];
    try {
      currentSets = row.sets ? JSON.parse(row.sets) : [];
    } catch {
      /* empty */
    }

    const feedbackRows = await getRecentExerciseFeedback(
      userWorkoutExerciseId,
      1,
    );
    const state = await getProgressionState(userWorkoutExerciseId, true);

    return {
      exerciseId: row.exercise_id,
      trackingType: row.tracking_type_override ?? row.tracking_type ?? "weight",
      equipment: row.equipment,
      currentSets,
      recentWorkingWeight: row.recent_weight ?? null,
      latestFeedback: feedbackRows[0] ?? null,
      consecutiveDirectionCount: state?.consecutiveDirectionCount ?? 1,
      discomfortStreakCount: state?.discomfortStreakCount ?? 0,
    };
  } catch (error: any) {
    console.error("Error fetching exercise progression context:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface WorkoutProgressionStateRow {
  id: number;
  userWorkoutExerciseId: number;
  exerciseName: string;
  suggestionAction: ProgressionAction;
  suggestedWeight?: number;
  /** Per-set suggested rep targets (one per working set, in order). */
  suggestedRepsPerSet?: number[];
  suggestedSets?: number;
  ruleKey: string;
  ruleExplanation: string;
  consecutiveDirectionCount: number;
  plateauAdvisory: boolean;
  lastProgressionAt?: string;
  recoveryRating?: string;
  isApplied: boolean;
  isDismissed: boolean;
}

export const getProgressionStatesForWorkout = async (
  workoutId: number,
  skipLayoffOverride = false,
): Promise<WorkoutProgressionStateRow[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const rows = await db.getAllAsync<{
      id: number;
      user_workout_exercise_id: number;
      exercise_name: string;
      suggestion_action: string;
      suggested_weight: number | null;
      suggested_reps_per_set: string | null;
      suggested_sets: number | null;
      rule_key: string;
      rule_explanation: string;
      consecutive_direction_count: number;
      plateau_advisory: number;
      last_progression_at: string | null;
      recovery_rating: string | null;
      is_applied: number;
      is_dismissed: number;
      target_muscle: string;
      equipment: string;
      tracking_type_override: string | null;
      tracking_type: string | null;
      recent_weight: number | null;
    }>(
      `SELECT
        eps.id,
        eps.user_workout_exercise_id,
        e.name AS exercise_name,
        eps.suggestion_action,
        eps.suggested_weight,
        eps.suggested_reps_per_set,
        eps.suggested_sets,
        eps.rule_key,
        eps.rule_explanation,
        eps.consecutive_direction_count,
        eps.plateau_advisory,
        eps.last_progression_at,
        eps.recovery_rating,
        eps.is_applied,
        eps.is_dismissed,
        e.target_muscle,
        e.equipment,
        uwe.tracking_type_override,
        e.tracking_type,
        ${RECENT_WEIGHT_SQL}
      FROM exercise_progression_state eps
      JOIN user_workout_exercises uwe ON uwe.id = eps.user_workout_exercise_id
      JOIN exercises e ON e.exercise_id = uwe.exercise_id
      WHERE uwe.workout_id = ?
        AND eps.is_dismissed = 0
      ORDER BY uwe.exercise_order ASC`,
      [workoutId],
    );

    const daysByMuscle = skipLayoffOverride
      ? {}
      : await getDaysSinceLastWorkoutByMuscle();
    const settings = skipLayoffOverride ? null : await getProgressionSettings();

    return rows.map((row) => {
      let parsedRepsPerSet: number[] | undefined;
      if (row.suggested_reps_per_set) {
        try {
          parsedRepsPerSet = JSON.parse(row.suggested_reps_per_set);
        } catch {
          parsedRepsPerSet = undefined;
        }
      }
      const base: WorkoutProgressionStateRow = {
        id: row.id,
        userWorkoutExerciseId: row.user_workout_exercise_id,
        exerciseName: row.exercise_name,
        suggestionAction: row.suggestion_action as ProgressionAction,
        suggestedWeight: row.suggested_weight ?? undefined,
        suggestedRepsPerSet: parsedRepsPerSet,
        suggestedSets: row.suggested_sets ?? undefined,
        ruleKey: row.rule_key,
        ruleExplanation: row.rule_explanation,
        consecutiveDirectionCount: row.consecutive_direction_count,
        plateauAdvisory: row.plateau_advisory === 1,
        lastProgressionAt: row.last_progression_at ?? undefined,
        recoveryRating: row.recovery_rating ?? undefined,
        isApplied: row.is_applied === 1,
        isDismissed: row.is_dismissed === 1,
      };

      if (skipLayoffOverride || !settings) return base;

      const trackingType =
        row.tracking_type_override ?? row.tracking_type ?? "weight";
      if (
        (trackingType !== "weight" && trackingType !== "assisted") ||
        row.recent_weight == null
      ) {
        return base;
      }

      const days = daysByMuscle[row.target_muscle];
      if (days == null) return base;

      const layoff = computeLayoffReduction(
        days,
        row.recent_weight,
        row.equipment,
        settings.increments,
      );
      if (!layoff) return base;

      return {
        ...base,
        suggestionAction: "reduce_load" as ProgressionAction,
        suggestedWeight: layoff.suggestedWeight,
        suggestedRepsPerSet: undefined,
        ruleKey: "MUSCLE_LAYOFF",
        ruleExplanation: `It's been ${days} days since you trained ${row.target_muscle}. We've suggested a lighter weight to help you ease back in safely.`,
      };
    });
  } catch (error: any) {
    console.error("Error fetching workout progression states:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export interface ProgressionRecomputeTarget {
  userWorkoutExerciseId: number;
  /** Heaviest working set (kg) in the latest remaining session, if any. */
  recentWorkingWeight: number | null;
  /** Reps per working set in that session, in order. */
  completedRepsPerSet: (number | null)[];
}

/**
 * The pending suggestions that an edit to, or deletion of, this completed
 * workout has made stale, each with the session data to rebuild it from.
 *
 * Only exercises for which the workout is their most recent session of the
 * plan workout: an older session did not produce the current suggestion, and
 * recomputing would override feedback given since. Quick workouts have no plan
 * exercises.
 * Works for a soft-deleted workout too, which is how deletion uses it.
 */
export const getProgressionRecomputeTargets = async (
  completedWorkoutId: number,
): Promise<ProgressionRecomputeTarget[]> => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const workout = await db.getFirstAsync<{
      workout_id: number | null;
      date_completed: string;
      is_deload: number;
    }>(
      `SELECT workout_id, date_completed, is_deload FROM completed_workouts WHERE id = ?`,
      [completedWorkoutId],
    );
    // A deload session is never the baseline, so changing it moves nothing.
    if (workout?.workout_id == null || workout.is_deload) return [];

    const pending = await db.getAllAsync<{
      user_workout_exercise_id: number;
      exercise_id: number;
    }>(
      `SELECT DISTINCT eps.user_workout_exercise_id, uwe.exercise_id
       FROM completed_exercises ce
       JOIN user_workout_exercises uwe
         ON uwe.workout_id = ? AND uwe.exercise_id = ce.exercise_id
        AND uwe.is_deleted = 0
       JOIN exercise_progression_state eps
         ON eps.user_workout_exercise_id = uwe.id
       WHERE ce.completed_workout_id = ?
         AND eps.is_applied = 0 AND eps.is_dismissed = 0`,
      [workout.workout_id, completedWorkoutId],
    );

    const targets: ProgressionRecomputeTarget[] = [];
    for (const row of pending) {
      // Only the latest session of this exercise feeds its suggestion. A later
      // workout that skipped the exercise does not count as newer.
      const newer = await db.getFirstAsync<{ id: number }>(
        `SELECT cw.id FROM completed_workouts cw
         JOIN completed_exercises ce ON ce.completed_workout_id = cw.id
         WHERE cw.workout_id = ? AND ce.exercise_id = ?
           AND cw.is_deleted = 0 AND ce.is_deleted = 0 AND cw.is_deload = 0
           AND cw.id != ?
           AND (cw.date_completed > ? OR (cw.date_completed = ? AND cw.id > ?))
         LIMIT 1`,
        [
          workout.workout_id,
          row.exercise_id,
          completedWorkoutId,
          workout.date_completed,
          workout.date_completed,
          completedWorkoutId,
        ],
      );
      if (newer) continue;

      const sets = await db.getAllAsync<{
        weight: number | null;
        reps: number | null;
      }>(
        `SELECT cs.weight, cs.reps
         FROM completed_sets cs
         WHERE cs.completed_exercise_id = ${baselineSessionSql("?", "?")}
           AND ${WORKING_SET_SQL}
         ORDER BY cs.set_number ASC`,
        [workout.workout_id, row.exercise_id],
      );
      const weights = sets
        .map((s) => s.weight)
        .filter((w): w is number => w != null);
      targets.push({
        userWorkoutExerciseId: row.user_workout_exercise_id,
        recentWorkingWeight: weights.length > 0 ? Math.max(...weights) : null,
        completedRepsPerSet: sets.map((s) => s.reps),
      });
    }
    return targets;
  } catch (error: any) {
    console.error("Error fetching progression recompute targets:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};
