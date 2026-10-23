// Seeds the demo history through the app's own data functions, and removes
// exactly what it seeded. What was inserted, and every value it replaced, is
// kept as JSON under the demo_seed setting.
import {
  deleteSetting,
  fetchActivePlan,
  fetchAllBodyMetricDefinitions,
  fetchSetting,
  getWeeklyCompletions,
  insertBodyMeasurementSession,
  insertExerciseFeedback,
  insertWorkoutPlan,
  isExercisePinned,
  openDatabase,
  pinExercise,
  saveCompletedWorkout,
  savePlanSchedule,
  saveWeekStart,
  updateActivePlan,
  updateProgressionStateRecovery,
  updateSettings,
  upsertWeeklyCompletion,
  type WeeklyCompletion,
} from "@/utils/database";
import { ensureAppExercisesExist } from "@/utils/loadPremadePlans";
import { recomputeProgression } from "@/utils/progressionRecompute";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { weekStartKeyFor } from "@/utils/week";
import { toLocalDateKey } from "@/utils/dates";
import {
  DEFAULT_PLAN_IMAGE_URL,
  type Set as PlanSet,
  type UserExercise,
  type Workout,
} from "@/store/workoutStore";
import { DEMO_SEED_KEY } from "./state";
import {
  history,
  measurementInstant,
  resolveSessions,
  scheduleDays,
  weekLoad,
  type EffortRating,
  type HistoryFixture,
  type PlanExerciseDef,
  type ResolvedSession,
} from "./history";

export interface DemoSeedRecord {
  version: 1;
  status: "seeded" | "removed";
  seededAt: string;
  removedAt?: string;
  planId: number | null;
  workoutIds: number[];
  workoutExerciseIds: number[];
  completedWorkoutIds: number[];
  feedbackIds: number[];
  measurementEntryIds: number[];
  /** recorded_at of the legacy body_measurements rows written alongside. */
  legacyBodyWeightDates: string[];
  /** Library exercises the seed had to copy in. */
  createdExerciseIds: number[];
  /** Pins the seed added; pins that already existed are not listed. */
  pinnedExerciseIds: number[];
  weeklyCompletions: { weekStart: string; previous: WeeklyCompletion | null }[];
  /** Each setting the seed wrote, with its value before (null: absent). */
  previousSettings: Record<string, string | null>;
  previousActivePlanId: number | null;
}

const WEEK_RULE_KEYS = [
  "weekStartsOn",
  "weekStartsOnPrevious",
  "weekStartsOnFrom",
];

export const readDemoSeedRecord = async (): Promise<DemoSeedRecord | null> => {
  const raw = await fetchSetting(DEMO_SEED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSeedRecord;
  } catch {
    return null;
  }
};

const writeRecord = (record: DemoSeedRecord) =>
  updateSettings(DEMO_SEED_KEY, JSON.stringify(record));

/** Completed workouts not created by the demo seed. */
export const countUserWorkouts = async (
  record: DemoSeedRecord | null = null,
): Promise<number> => {
  const db = await openDatabase("userData.db");
  try {
    const ids = record?.completedWorkoutIds ?? [];
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM completed_workouts
       WHERE is_deleted = 0 AND id NOT IN (${ids.map(() => "?").join(",")})`,
      ids,
    );
    return row?.count ?? 0;
  } finally {
    await db.closeAsync();
  }
};

// ─── plan ─────────────────────────────────────────────────────────────────────

const restOf = (seconds: number) => ({
  restMinutes: Math.floor(seconds / 60),
  restSeconds: seconds % 60,
});

const planSets = (ex: PlanExerciseDef): PlanSet[] => [
  ...(ex.warmupReps ?? []).map((reps): PlanSet => ({
    repsMin: reps,
    repsMax: reps,
    ...restOf(60),
    time: undefined,
    isWarmup: true,
  })),
  ...Array.from({ length: ex.working }, (): PlanSet => ({
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    ...restOf(ex.rest),
    time: undefined,
  })),
];

interface ExerciseInfo {
  exerciseId: number;
  equipment: string;
  trackingType: string;
}

const lookUpExercises = async (
  appExerciseIds: number[],
): Promise<{ byAppId: Map<number, ExerciseInfo>; created: number[] }> => {
  const db = await openDatabase("userData.db");
  try {
    const before = new Set(
      (
        await db.getAllAsync<{ exercise_id: number }>(
          "SELECT exercise_id FROM exercises",
        )
      ).map((r) => r.exercise_id),
    );
    await ensureAppExercisesExist(db, appExerciseIds);
    const byAppId = new Map<number, ExerciseInfo>();
    const created: number[] = [];
    for (const appId of appExerciseIds) {
      const row = await db.getFirstAsync<{
        exercise_id: number;
        equipment: string | null;
        tracking_type: string | null;
      }>(
        `SELECT exercise_id, equipment, tracking_type FROM exercises
         WHERE app_exercise_id = ? LIMIT 1`,
        [appId],
      );
      if (!row) throw new Error(`Demo exercise ${appId} is not in the library`);
      if (!before.has(row.exercise_id)) created.push(row.exercise_id);
      byAppId.set(appId, {
        exerciseId: row.exercise_id,
        equipment: row.equipment ?? "",
        trackingType: resolvedTrackingType({
          tracking_type: row.tracking_type,
        } as UserExercise),
      });
    }
    return { byAppId, created };
  } finally {
    await db.closeAsync();
  }
};

const premadeImageUrl = async (appPlanId: number): Promise<string> => {
  const db = await openDatabase("userData.db");
  try {
    const row = await db.getFirstAsync<{ image_url: string | null }>(
      "SELECT image_url FROM user_plans WHERE app_plan_id = ? LIMIT 1",
      [appPlanId],
    );
    return row?.image_url || DEFAULT_PLAN_IMAGE_URL;
  } finally {
    await db.closeAsync();
  }
};

/** Workout ids in plan order, and each workout's row ids in exercise order. */
const readPlanRows = async (
  planId: number,
): Promise<{ workoutId: number; rowIds: number[] }[]> => {
  const db = await openDatabase("userData.db");
  try {
    const workouts = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM user_workouts WHERE plan_id = ? AND is_deleted = 0
       ORDER BY workout_order`,
      [planId],
    );
    const result = [];
    for (const { id } of workouts) {
      const rows = await db.getAllAsync<{ id: number }>(
        `SELECT id FROM user_workout_exercises
         WHERE workout_id = ? AND is_deleted = 0 ORDER BY exercise_order, id`,
        [id],
      );
      result.push({ workoutId: id, rowIds: rows.map((r) => r.id) });
    }
    return result;
  } finally {
    await db.closeAsync();
  }
};

// ─── sessions ─────────────────────────────────────────────────────────────────

const roundTo = (value: number, step: number) =>
  Math.round(Math.round(value / step) * step * 100) / 100;

interface LoggedSet {
  set_number: number;
  weight: number | null;
  reps: number | null;
  time: null;
  distance: null;
  is_warmup: boolean;
  is_drop_set: boolean;
  set_duration: number;
}

// Seconds from the end of rest to pressing Complete Set: a few seconds to
// set up plus about three per rep, varied so durations do not look generated.
const setDuration = (reps: number, salt: number) =>
  12 + reps * 3 + ((salt * 7) % 9);

const loggedSets = (
  ex: PlanExerciseDef,
  session: ResolvedSession,
  fx: HistoryFixture,
): LoggedSet[] => {
  const [kg, reps] = weekLoad(fx, ex.key, session.def.week);
  if (reps.length !== ex.working) {
    throw new Error(
      `Demo load for ${ex.key} week ${session.def.week} has ${reps.length} sets, the plan has ${ex.working}`,
    );
  }
  const sets: Omit<LoggedSet, "set_number">[] = [];
  (ex.warmupReps ?? []).forEach((warmupReps, i) => {
    const percent = ex.warmupPercents?.[i] ?? 0.5;
    sets.push({
      weight: Math.max(20, roundTo(kg * percent, 2.5)),
      reps: warmupReps,
      time: null,
      distance: null,
      is_warmup: true,
      is_drop_set: false,
      set_duration: setDuration(warmupReps, i + session.def.week),
    });
  });
  reps.forEach((r, i) => {
    sets.push({
      weight: kg,
      reps: r,
      time: null,
      distance: null,
      is_warmup: false,
      is_drop_set: false,
      set_duration: setDuration(r, i + session.def.slot),
    });
  });
  if (session.def.dropSets?.includes(ex.key)) {
    sets.push({
      weight: roundTo(kg * 0.7, 2.5),
      reps: ex.repsMax,
      time: null,
      distance: null,
      is_warmup: false,
      is_drop_set: true,
      set_duration: setDuration(ex.repsMax, session.def.week),
    });
  }
  return sets.map((s, i) => ({ ...s, set_number: i + 1 }));
};

/** What the workout screen hands the feedback mutation for one exercise. */
const feedbackInputs = (ex: PlanExerciseDef, sets: LoggedSet[]) => {
  const working = sets.filter((s) => !s.is_warmup && !s.is_drop_set);
  const target = ex.working * ex.repsMin;
  const actual = working.reduce((sum, s) => sum + (s.reps ?? 0), 0);
  return {
    performanceRatio: target > 0 ? Math.min(actual / target, 1.5) : 1,
    completedRepsPerSet: working.map((s) => s.reps),
    recentWorkingWeight: Math.max(...working.map((s) => s.weight ?? 0)),
  };
};

// ─── seed ─────────────────────────────────────────────────────────────────────

const emptyRecord = (now: Date): DemoSeedRecord => ({
  version: 1,
  status: "seeded",
  seededAt: now.toISOString(),
  planId: null,
  workoutIds: [],
  workoutExerciseIds: [],
  completedWorkoutIds: [],
  feedbackIds: [],
  measurementEntryIds: [],
  legacyBodyWeightDates: [],
  createdExerciseIds: [],
  pinnedExerciseIds: [],
  weeklyCompletions: [],
  previousSettings: {},
  previousActivePlanId: null,
});

/**
 * Writes a setting through updateSettings, remembering its old value the
 * first time it is touched.
 */
const setSetting = async (
  record: DemoSeedRecord,
  key: string,
  value: string,
) => {
  await rememberSetting(record, key);
  await updateSettings(key, value);
};

const rememberSetting = async (record: DemoSeedRecord, key: string) => {
  if (!(key in record.previousSettings)) {
    record.previousSettings[key] = await fetchSetting(key);
  }
};

/**
 * Seeds the demo history once. Returns the existing record without writing
 * anything when demo data is already in the database. If a step fails,
 * whatever was written so far is removed again before the error is thrown.
 */
export const seedDemoData = async (
  now: Date = new Date(),
  fx: HistoryFixture = history,
): Promise<DemoSeedRecord> => {
  const existing = await readDemoSeedRecord();
  if (existing?.status === "seeded") return existing;

  const record = emptyRecord(now);
  try {
    await seedInto(record, now, fx);
  } catch (error) {
    await removeRecordedRows(record).catch((cleanupError) =>
      console.error("Demo seed cleanup failed:", cleanupError),
    );
    throw error;
  }
  await writeRecord(record);
  return record;
};

const seedInto = async (
  record: DemoSeedRecord,
  now: Date,
  fx: HistoryFixture,
) => {
  const planDefs = fx.plan.workouts;
  const allDefs = planDefs.flatMap((w) => w.exercises);
  const { byAppId, created } = await lookUpExercises([
    ...new Set(allDefs.map((e) => e.appExerciseId)),
  ]);
  record.createdExerciseIds = created;
  const infoOf = (ex: PlanExerciseDef) => byAppId.get(ex.appExerciseId)!;

  // The plan, saved the way the editor saves a customised premade plan.
  const workouts: Workout[] = planDefs.map((w) => ({
    name: w.name,
    exercises: w.exercises.map(
      (ex) =>
        ({
          exercise_id: infoOf(ex).exerciseId,
          sets: planSets(ex),
          supersetGroupId: ex.superset ? `demo-${ex.superset}` : undefined,
        }) as UserExercise,
    ),
  }));
  const planId = await insertWorkoutPlan(
    fx.plan.name,
    await premadeImageUrl(fx.plan.basedOnAppPlanId),
    workouts,
  );
  if (planId == null) throw new Error("insertWorkoutPlan returned no id");
  record.planId = planId;
  const rows = await readPlanRows(planId);
  record.workoutIds = rows.map((r) => r.workoutId);
  record.workoutExerciseIds = rows.flatMap((r) => r.rowIds);

  // Schedule, then activate it as useSetActivePlanMutation does: the weekly
  // goal follows the number of scheduled days.
  const days = scheduleDays(now, fx.scheduleByWeekday);
  await savePlanSchedule(
    planId,
    rows.map((r, i) => ({ day_of_week: days[i], workout_id: r.workoutId })),
  );
  const previousActive = (await fetchActivePlan()) as { id: number } | null;
  record.previousActivePlanId = previousActive?.id ?? null;
  await updateActivePlan(planId);
  await setSetting(record, "weeklyGoal", String(fx.weeklyGoal));

  for (const [key, value] of Object.entries(fx.settings)) {
    if (key === "about") continue;
    await setSetting(record, key, value);
  }
  for (const key of WEEK_RULE_KEYS) await rememberSetting(record, key);
  await saveWeekStart(1, now, { immediately: true });
  const snoozeUntil = new Date(
    now.getTime() + fx.backupReminderSnoozeDays * 24 * 60 * 60 * 1000,
  );
  await setSetting(
    record,
    "backupReminderSnoozedUntil",
    snoozeUntil.toISOString(),
  );

  // Training history.
  const sessions = resolveSessions(now, fx);
  const latestBySlot = new Map<
    number,
    { session: ResolvedSession; sets: LoggedSet[][] }
  >();
  for (const session of sessions) {
    const slotRows = rows[session.def.slot];
    const exercises = session.workout.exercises.map((ex, i) => ({
      exercise_id: infoOf(ex).exerciseId,
      resolved_tracking_type: infoOf(ex).trackingType,
      user_workout_exercise_id: slotRows.rowIds[i],
      sets: loggedSets(ex, session, fx),
    }));
    const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
    const id = await saveCompletedWorkout(
      planId,
      slotRows.workoutId,
      session.def.minutes * 60,
      totalSets,
      session.isDeload,
      exercises,
      session.end,
      session.def.note ?? null,
    );
    record.completedWorkoutIds.push(id);
    if (!session.isDeload) {
      latestBySlot.set(session.def.slot, {
        session,
        sets: exercises.map((e) => e.sets),
      });
    }
  }

  // Weekly goal history for the weeks already over, as useWeeklyStreak
  // records them week by week.
  const rule = { weekStartsOn: 1 as const };
  const currentWeekStart = weekStartKeyFor(toLocalDateKey(now), rule);
  const daysByWeek = new Map<string, Set<string>>();
  for (const s of sessions) {
    const weekStart = weekStartKeyFor(s.localDate, rule);
    if (weekStart >= currentWeekStart) continue;
    const set = daysByWeek.get(weekStart) ?? new Set<string>();
    set.add(s.localDate);
    daysByWeek.set(weekStart, set);
  }
  const previousRows = await getWeeklyCompletions();
  for (const [weekStart, trainingDays] of daysByWeek) {
    record.weeklyCompletions.push({
      weekStart,
      previous: previousRows.find((r) => r.week_start === weekStart) ?? null,
    });
    await upsertWeeklyCompletion(
      weekStart,
      fx.weeklyGoal,
      trainingDays.size,
      trainingDays.size >= fx.weeklyGoal,
    );
  }

  // Post-exercise feedback on each workout's latest session, turned into the
  // pending suggestion by the rules engine. The recovery check-in is answered
  // ("fresh") so starting the next workout does not ask for it.
  for (const [slot, { sets }] of latestBySlot) {
    const workout = planDefs[slot];
    for (const [i, ex] of workout.exercises.entries()) {
      const effort = fx.feedback[ex.key] as EffortRating | undefined;
      if (!effort) continue;
      const rowId = rows[slot].rowIds[i];
      const inputs = feedbackInputs(ex, sets[i]);
      record.feedbackIds.push(
        await insertExerciseFeedback({
          userWorkoutExerciseId: rowId,
          effortRating: effort,
          painFlag: "none",
          performanceRatio: inputs.performanceRatio,
        }),
      );
      await recomputeProgression(rowId, {
        session: {
          recentWorkingWeight: inputs.recentWorkingWeight,
          completedRepsPerSet: inputs.completedRepsPerSet,
        },
      });
      await updateProgressionStateRecovery(rowId, "fresh");
    }
  }

  // Body measurements. insertBodyMeasurementSession also writes the legacy
  // body weight row and the bodyWeight setting.
  await rememberSetting(record, "bodyWeight");
  const metricIds = new Map(
    (await fetchAllBodyMetricDefinitions()).map((d) => [d.key, d.id]),
  );
  for (const { day, ...values } of fx.measurements) {
    const recordedAt = measurementInstant(
      now,
      day,
      fx.measurementTime,
    ).toISOString();
    const entryValues = Object.entries(values).map(([key, value]) => {
      const metricId = metricIds.get(key);
      if (metricId == null) throw new Error(`No body metric "${key}"`);
      return { metric_id: metricId, value };
    });
    record.measurementEntryIds.push(
      await insertBodyMeasurementSession(recordedAt, entryValues),
    );
    if (values.weight != null) record.legacyBodyWeightDates.push(recordedAt);
  }

  // Pinned to Stats, for the sparklines.
  for (const key of fx.pinnedExercises) {
    const def = allDefs.find((e) => e.key === key);
    if (!def) throw new Error(`No demo exercise "${key}" to pin`);
    const { exerciseId } = infoOf(def);
    if (await isExercisePinned(exerciseId)) continue;
    await pinExercise(exerciseId);
    record.pinnedExerciseIds.push(exerciseId);
  }
};

// ─── removal ──────────────────────────────────────────────────────────────────

const inList = (ids: readonly unknown[]) => ids.map(() => "?").join(",");

/** Deletes the rows a record lists and puts back the values it replaced. */
const removeRecordedRows = async (record: DemoSeedRecord): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const run = async (sql: string, params: (string | number)[]) => {
        if (params.length > 0) await txn.runAsync(sql, params);
      };
      const cw = record.completedWorkoutIds;
      await run(
        `DELETE FROM completed_sets WHERE completed_exercise_id IN (
           SELECT id FROM completed_exercises
           WHERE completed_workout_id IN (${inList(cw)}))`,
        cw,
      );
      await run(
        `DELETE FROM completed_exercises WHERE completed_workout_id IN (${inList(cw)})`,
        cw,
      );
      await run(
        `DELETE FROM completed_workouts WHERE id IN (${inList(cw)})`,
        cw,
      );

      // Feedback and suggestions belong to the demo plan's rows, which go too.
      const uwe = record.workoutExerciseIds;
      await run(
        `DELETE FROM exercise_progression_state
         WHERE user_workout_exercise_id IN (${inList(uwe)})`,
        uwe,
      );
      await run(
        `DELETE FROM exercise_feedback WHERE user_workout_exercise_id IN (${inList(uwe)})`,
        uwe,
      );

      const workouts = record.workoutIds;
      if (record.planId != null) {
        await run(`DELETE FROM plan_schedule WHERE plan_id = ?`, [
          record.planId,
        ]);
      }
      await run(
        `DELETE FROM user_workout_exercises WHERE workout_id IN (${inList(workouts)})`,
        workouts,
      );
      await run(
        `DELETE FROM user_workouts WHERE id IN (${inList(workouts)})`,
        workouts,
      );
      if (record.planId != null) {
        await run(`DELETE FROM user_plans WHERE id = ?`, [record.planId]);
        await run(`DELETE FROM settings WHERE key = ?`, [
          `plan_${record.planId}_deload_week`,
        ]);
      }

      const entries = record.measurementEntryIds;
      await run(
        `DELETE FROM body_measurement_values WHERE entry_id IN (${inList(entries)})`,
        entries,
      );
      await run(
        `DELETE FROM body_measurement_entries WHERE id IN (${inList(entries)})`,
        entries,
      );
      const legacy = record.legacyBodyWeightDates;
      await run(
        `DELETE FROM body_measurements WHERE date IN (${inList(legacy)})`,
        legacy,
      );

      for (const { weekStart, previous } of record.weeklyCompletions) {
        if (previous) {
          await txn.runAsync(
            `INSERT OR REPLACE INTO weekly_completions (week_start, goal, completed, goal_reached) VALUES (?, ?, ?, ?)`,
            [
              weekStart,
              previous.goal,
              previous.completed,
              previous.goal_reached ? 1 : 0,
            ],
          );
        } else {
          await txn.runAsync(
            `DELETE FROM weekly_completions WHERE week_start = ?`,
            [weekStart],
          );
        }
      }

      const pinned = record.pinnedExerciseIds;
      await run(
        `DELETE FROM tracked_exercises WHERE exercise_id IN (${inList(pinned)})`,
        pinned,
      );
      // Library exercises copied in for the plan, unless something else
      // uses them by now.
      for (const id of record.createdExerciseIds) {
        await txn.runAsync(
          `DELETE FROM exercises WHERE exercise_id = ?
             AND NOT EXISTS (SELECT 1 FROM user_workout_exercises WHERE exercise_id = ?)
             AND NOT EXISTS (SELECT 1 FROM completed_exercises WHERE exercise_id = ?)`,
          [id, id, id],
        );
      }

      for (const [key, value] of Object.entries(record.previousSettings)) {
        if (value === null) {
          await txn.runAsync(`DELETE FROM settings WHERE key = ?`, [key]);
        } else {
          await txn.runAsync(
            `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
            [key, value],
          );
        }
      }

      // The demo plan was active; hand that back to the plan before it,
      // unless another live plan has been made active or that one has been
      // deleted since. Deleted plans lose a stale active flag either way.
      if (record.previousActivePlanId != null) {
        const stillActive = await txn.getFirstAsync<{ id: number }>(
          `SELECT id FROM user_plans
           WHERE is_active = TRUE AND is_deleted = FALSE LIMIT 1`,
        );
        const previous = await txn.getFirstAsync<{ id: number }>(
          `SELECT id FROM user_plans WHERE id = ? AND is_deleted = FALSE`,
          [record.previousActivePlanId],
        );
        if (!stillActive && previous) {
          await txn.runAsync(
            `UPDATE user_plans SET is_active = (id = ?) WHERE is_active != (id = ?)`,
            [previous.id, previous.id],
          );
        }
      }
    });
  } finally {
    await db.closeAsync();
  }
};

/**
 * Removes the seeded rows and restores what the seed changed. The record
 * stays, marked removed, so the next launch does not seed again on its own.
 * Returns false when there was nothing to remove.
 */
export const removeDemoData = async (
  now: Date = new Date(),
): Promise<boolean> => {
  const record = await readDemoSeedRecord();
  if (!record || record.status !== "seeded") return false;
  await removeRecordedRows(record);
  await writeRecord({
    ...record,
    status: "removed",
    removedAt: now.toISOString(),
  });
  return true;
};

/** Forgets a removed seed, so the demo data can be loaded again. */
export const clearDemoSeedRecord = async (): Promise<void> => {
  const record = await readDemoSeedRecord();
  if (record?.status === "seeded") {
    throw new Error("Remove the demo data before clearing its record");
  }
  await deleteSetting(DEMO_SEED_KEY);
};
