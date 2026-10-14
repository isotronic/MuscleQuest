// The demo history fixture, typed, and the date logic that places it relative
// to today. Pure: nothing here touches the database.
import { toLocalDateKey } from "@/utils/dates";
import { mondayIndex, startOfAppWeek } from "@/utils/week";
import fixture from "./fixtures/history.json";

export type EffortRating = "easy" | "moderate" | "hard" | "failed";

export interface PlanExerciseDef {
  key: string;
  appExerciseId: number;
  working: number;
  repsMin: number;
  repsMax: number;
  /** Seconds after each working set. */
  rest: number;
  warmupReps?: number[];
  /** Fraction of the session's working weight for each warm-up set. */
  warmupPercents?: number[];
  /** Exercises sharing a value form one superset. */
  superset?: string;
}

interface WorkoutDef {
  key: string;
  name: string;
  exercises: PlanExerciseDef[];
}

interface SessionDef {
  week: number;
  /** Which plan workout, and which of the week's training days. */
  slot: number;
  /** Local start time, "HH:MM". */
  start: string;
  minutes: number;
  /** Exercise keys that end with one drop set. */
  dropSets?: string[];
  note?: string;
}

interface MeasurementDef {
  /** Days from today, negative. */
  day: number;
  /** Values by body_metric_definitions.key, canonical units. */
  [metricKey: string]: number;
}

/** [kg, reps per working set] for one week. */
export type WeekLoad = [number, number[]];

export interface HistoryFixture {
  plan: { basedOnAppPlanId: number; name: string; workouts: WorkoutDef[] };
  scheduleByWeekday: Record<string, number[] | string>;
  deloadWeeks: number[];
  progressions: Record<string, WeekLoad[] | string>;
  sessions: SessionDef[];
  feedback: Record<string, EffortRating | string>;
  pinnedExercises: string[];
  measurements: MeasurementDef[];
  measurementTime: string;
  weeklyGoal: number;
  settings: Record<string, string>;
  backupReminderSnoozeDays: number;
}

export const history = fixture as unknown as HistoryFixture;

/** The weeks of `sessions` run 1 to this one, the week containing today. */
const currentWeek = (sessions: SessionDef[]): number =>
  Math.max(...sessions.map((s) => s.week));

/** The weekdays (0 = Monday) the plan's workouts fall on, by slot. */
export const scheduleDays = (
  today: Date,
  byWeekday: HistoryFixture["scheduleByWeekday"],
): number[] => {
  const days = byWeekday[String(mondayIndex(today))];
  if (!Array.isArray(days)) {
    throw new Error(`No demo schedule for weekday ${mondayIndex(today)}`);
  }
  return days;
};

export const weekLoad = (
  fx: HistoryFixture,
  exerciseKey: string,
  week: number,
): WeekLoad => {
  const loads = fx.progressions[exerciseKey];
  if (!Array.isArray(loads) || !loads[week - 1]) {
    throw new Error(`No demo load for ${exerciseKey} in week ${week}`);
  }
  return loads[week - 1];
};

export interface ResolvedSession {
  def: SessionDef;
  workout: WorkoutDef;
  start: Date;
  end: Date;
  /** The training day, "YYYY-MM-DD". */
  localDate: string;
  isDeload: boolean;
}

const atLocalTime = (base: Date, dayOffset: number, time: string): Date => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + dayOffset,
    hours,
    minutes,
  );
};

/**
 * The fixture's sessions placed on real days: the current week is the one
 * containing `today` (Monday weeks), and each session lands on its slot's
 * weekday. Sessions on or after today are left out, so the next workout is
 * still to do. Oldest first.
 */
export const resolveSessions = (
  today: Date,
  fx: HistoryFixture = history,
): ResolvedSession[] => {
  const days = scheduleDays(today, fx.scheduleByWeekday);
  const weekStart = startOfAppWeek(today, { weekStartsOn: 1 });
  const lastWeek = currentWeek(fx.sessions);
  const todayKey = toLocalDateKey(today);
  return fx.sessions
    .map((def) => {
      const start = atLocalTime(
        weekStart,
        (def.week - lastWeek) * 7 + days[def.slot],
        def.start,
      );
      return {
        def,
        workout: fx.plan.workouts[def.slot],
        start,
        end: new Date(start.getTime() + def.minutes * 60_000),
        localDate: toLocalDateKey(start),
        isDeload: fx.deloadWeeks.includes(def.week),
      };
    })
    .filter((s) => s.localDate < todayKey)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

/** A measurement's instant: its day offset at the fixture's time of day. */
export const measurementInstant = (
  today: Date,
  day: number,
  time: string = history.measurementTime,
): Date => atLocalTime(today, day, time);
