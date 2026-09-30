import type { QueryClient } from "@tanstack/react-query";
import {
  getExerciseProgressionContext,
  getProgressionRecomputeTargets,
  getProgressionSettings,
  getProgressionState,
  upsertProgressionState,
} from "@/utils/database";
import { evaluateProgression } from "@/utils/progressionEngine";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import {
  ExerciseFeedbackPayload,
  ProgressionAction,
  ProgressionEngineInputs,
  RecoveryRating,
} from "@/types/progression";

const STAGNATION_HOLD_RULES = new Set([
  "MODERATE_TARGET",
  "HARD_TARGET",
  "BELOW_TARGET",
  "NEAR_TARGET",
]);

const PROGRESSION_ACTIONS = new Set<ProgressionAction>([
  "increase_load",
  "increase_reps",
  "add_set",
]);

interface RecomputeOptions {
  recoveryRating?: RecoveryRating;
  /**
   * Session data to evaluate against, for a recompute after history changed.
   * Without it the engine gets the stored context only, as the recovery
   * check-in always has.
   */
  session?: {
    recentWorkingWeight: number | null;
    completedRepsPerSet: (number | null)[];
  };
  /**
   * Re-evaluating the same session must not advance the hold streak or the
   * last-progression date a second time.
   */
  keepStreaks?: boolean;
}

/**
 * Re-runs the rules engine for one plan exercise from its stored feedback and
 * replaces the pending suggestion. Returns false when there is nothing to
 * recompute from.
 */
export async function recomputeProgression(
  userWorkoutExerciseId: number,
  { recoveryRating, session, keepStreaks = false }: RecomputeOptions = {},
): Promise<boolean> {
  const [ctx, existingState, progressionSettings] = await Promise.all([
    getExerciseProgressionContext(userWorkoutExerciseId),
    getProgressionState(userWorkoutExerciseId),
    getProgressionSettings(),
  ]);
  if (!ctx?.latestFeedback) return false;

  const latestFeedback: ExerciseFeedbackPayload = {
    userWorkoutExerciseId,
    effortRating: ctx.latestFeedback.effortRating,
    painFlag: ctx.latestFeedback.painFlag,
    progressionIntent: ctx.latestFeedback.progressionIntent,
    performanceRatio: ctx.latestFeedback.performanceRatio,
  };

  const engineInputs: ProgressionEngineInputs = {
    userWorkoutExerciseId,
    exerciseId: ctx.exerciseId,
    trackingType: ctx.trackingType,
    equipment: ctx.equipment,
    currentSets: ctx.currentSets,
    recentWorkingWeight: session
      ? session.recentWorkingWeight
      : ctx.recentWorkingWeight,
    latestFeedback,
    priorFeedbackHistory: [],
    recoveryRating: recoveryRating ?? existingState?.recoveryRating ?? null,
    consecutiveDirectionCount: ctx.consecutiveDirectionCount,
    discomfortStreakCount: ctx.discomfortStreakCount,
    userIncrements: progressionSettings.increments,
    ...(session ? { completedRepsPerSet: session.completedRepsPerSet } : {}),
  };

  const result = evaluateProgression(engineInputs);

  const previousHoldCount = existingState?.consecutiveHoldCount ?? 0;
  const isProgression = PROGRESSION_ACTIONS.has(result.action);
  const isStagnationHold = STAGNATION_HOLD_RULES.has(result.ruleKey);
  const newConsecutiveHoldCount = keepStreaks
    ? previousHoldCount
    : isProgression
      ? 0
      : isStagnationHold
        ? previousHoldCount + 1
        : previousHoldCount;
  const plateauAdvisory = newConsecutiveHoldCount >= 4;
  const lastProgressionAt =
    isProgression && !keepStreaks
      ? new Date().toISOString()
      : (existingState?.lastProgressionAt ?? null);

  await upsertProgressionState(
    userWorkoutExerciseId,
    result,
    ctx.latestFeedback.id,
    ctx.consecutiveDirectionCount,
    {
      discomfortStreakCount: ctx.discomfortStreakCount,
      consecutiveHoldCount: newConsecutiveHoldCount,
      plateauAdvisory,
      lastProgressionAt,
    },
  );
  return true;
}

/**
 * Refreshes the pending suggestions that editing or deleting a completed
 * workout has made stale, and returns the plan exercises it touched.
 *
 * Known limitation: the stored feedback's performance_ratio was computed from
 * the reps logged at the time and is not recalculated, because feedback is no
 * longer linked to a completed workout. A corrected weight is fully handled;
 * corrected reps change the rep targets but not the ratio the rules gate on.
 */
export async function recomputeProgressionForCompletedWorkout(
  completedWorkoutId: number,
): Promise<number[]> {
  const settings = await getProgressionSettings();
  if (!settings.enabled) return [];

  const targets = await getProgressionRecomputeTargets(completedWorkoutId);
  const recomputed: number[] = [];
  for (const { userWorkoutExerciseId, ...session } of targets) {
    const done = await recomputeProgression(userWorkoutExerciseId, {
      session,
      keepStreaks: true,
    });
    if (done) recomputed.push(userWorkoutExerciseId);
  }
  return recomputed;
}

/**
 * For mutation handlers: recompute, then refetch the suggestion queries. A
 * failure here must not fail the history change that triggered it.
 */
export async function refreshProgressionAfterHistoryChange(
  queryClient: QueryClient,
  completedWorkoutId: number,
): Promise<void> {
  try {
    const recomputed =
      await recomputeProgressionForCompletedWorkout(completedWorkoutId);
    if (recomputed.length === 0) return;
    queryClient.invalidateQueries({ queryKey: ["progressionState"] });
    queryClient.invalidateQueries({ queryKey: ["workoutProgressionStates"] });
  } catch (error) {
    console.error("Error refreshing progression suggestions:", error);
    notifyBugsnag(error);
  }
}
