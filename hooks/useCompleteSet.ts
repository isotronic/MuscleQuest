import { useCallback, useMemo, useRef } from "react";
import { AccessibilityInfo, Vibration } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { t } from "@lingui/core/macro";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { useSessionPRs } from "@/hooks/useSessionPRs";
import { isSessionPR } from "@/utils/sessionPRs";
import { sessionSupportsProgression } from "@/utils/progressionEligibility";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { findSupersetPartnerIndex } from "@/utils/supersetUtils";
import {
  checkWeightPlausibility,
  heaviestWorkingWeight,
} from "@/utils/weightPlausibility";
import { confirmImplausibleWeight } from "@/utils/confirmImplausibleWeight";
import {
  buildExerciseMap,
  findLastAvailableSetData as findLastAvailableSetDataUtil,
} from "@/utils/carryOverLookup";
import { instanceName, rowIdentity } from "@/utils/exerciseInstance";
import { displayToKg } from "@/utils/weightUnits";
import {
  cancelRestNotifications,
  startRestNotification,
} from "@/utils/restNotification";
import { setCompleteAnnouncement } from "@/utils/a11yAnnouncements";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";
import type { UserExercise } from "@/store/workoutStore";

export const PR_VIBRATION = [0, 60, 80, 60];

type CompletedSets = Record<number, Record<number, boolean>>;

/** A set's values as the session keeps them: display-unit strings. */
export interface SetValues {
  weight: string;
  reps: string;
  time: string;
  distance: string;
}

/** A set whose values were written, before it is marked done. */
export interface PreparedSet extends SetValues {
  exerciseIndex: number;
  setIndex: number;
  isPR: boolean;
  /** Feedback cards this set unlocks, to queue once it is marked done. */
  feedbackContexts: FeedbackPrompt[];
}

/**
 * The seconds of rest after a set done in place: its own rest, unless it is
 * the first half of a superset round (the partner comes next) or nothing is
 * left to do.
 */
export function restAfterSetInPlace(
  exercises: UserExercise[],
  completedSets: CompletedSets,
  exerciseIndex: number,
  setIndex: number,
): number {
  const set = exercises[exerciseIndex]?.sets[setIndex];
  if (!set) return 0;
  const partnerIndex = exercises[exerciseIndex].supersetGroupId
    ? findSupersetPartnerIndex(exercises, exerciseIndex)
    : -1;
  if (
    partnerIndex !== -1 &&
    setIndex < exercises[partnerIndex].sets.length &&
    completedSets[partnerIndex]?.[setIndex] !== true
  ) {
    return 0;
  }
  const anyLeft = exercises.some((exercise, ei) =>
    exercise.sets.some((_, si) => completedSets[ei]?.[si] !== true),
  );
  if (!anyLeft) return 0;
  return (set.restMinutes || 0) * 60 + (set.restSeconds || 0);
}

/**
 * Completing a set, shared by the focus screen's Complete Set, the overview's
 * set rows and the list logging mode, so all three check implausible weights,
 * write the same values, flag PRs, end a running rest and build the same
 * feedback cards.
 */
export function useCompleteSet() {
  const {
    workout,
    weightAndReps,
    previousWorkoutData,
    globalHistoryData,
    activeWorkout,
    isQuickWorkout,
    feedbackSubmittedUweIds,
  } = useActiveWorkoutStore(
    useShallow((s) => ({
      workout: s.workout,
      weightAndReps: s.weightAndReps,
      previousWorkoutData: s.previousWorkoutData,
      globalHistoryData: s.globalHistoryData,
      activeWorkout: s.activeWorkout,
      isQuickWorkout: s.isQuickWorkout,
      feedbackSubmittedUweIds: s.feedbackSubmittedUweIds,
    })),
  );
  const { data: settings } = useSettingsQuery();
  const progressionSettings = useProgressionSettingsQuery();
  const { isCurrentWeekDeload } = useDeloadWeekQuery(
    activeWorkout?.planId ?? undefined,
  );
  const { prsWithSetCompleted } = useSessionPRs();
  const weightUnit = settings?.weightUnit || "kg";
  const alwaysUseGlobalHistory = settings?.alwaysUseGlobalHistory === "true";

  const prevExercisesByExerciseId = useMemo(
    () => buildExerciseMap(previousWorkoutData),
    [previousWorkoutData],
  );
  const globalExercisesByExerciseId = useMemo(
    () => buildExerciseMap(globalHistoryData),
    [globalHistoryData],
  );

  // Weights the user already confirmed this session, per exercise, so the
  // same entry is not questioned twice.
  const confirmedWeightsRef = useRef(new Set<string>());

  /** The matching set from history, used to pre-fill an untouched set. */
  const findLastAvailableSetData = useCallback(
    (exerciseId: number, setIndex: number, exercisePosition?: number) => {
      const targetSets =
        exercisePosition !== undefined
          ? (workout?.exercises[exercisePosition]?.sets ?? [])
          : (workout?.exercises.find((e) => e.exercise_id === exerciseId)
              ?.sets ?? []);
      const isWarmup = targetSets[setIndex]?.isWarmup ?? false;
      const ordinal = targetSets
        .slice(0, setIndex)
        .filter((s) => (s.isWarmup ?? false) === isWarmup).length;

      return findLastAvailableSetDataUtil({
        exerciseId,
        isWarmup,
        ordinal,
        exercisePosition,
        row:
          exercisePosition !== undefined && workout
            ? rowIdentity(workout.exercises, exercisePosition)
            : undefined,
        previousWorkoutData,
        prevExercisesByExerciseId,
        globalExercisesByExerciseId,
        alwaysUseGlobalHistory,
      });
    },
    [
      workout,
      previousWorkoutData,
      prevExercisesByExerciseId,
      globalExercisesByExerciseId,
      alwaysUseGlobalHistory,
    ],
  );

  const valuesFrom = useCallback(
    (
      entries: typeof weightAndReps,
      exerciseIndex: number,
      setIndex: number,
    ): SetValues => {
      const exercise = workout?.exercises[exerciseIndex];
      const entered = entries[exerciseIndex]?.[setIndex];
      const prefill = exercise
        ? findLastAvailableSetData(
            exercise.exercise_id,
            setIndex,
            exerciseIndex,
          )
        : null;
      return {
        weight: entered?.weight ?? prefill?.weight?.toString() ?? "",
        reps: entered?.reps ?? prefill?.reps?.toString() ?? "",
        time: entered?.time ?? prefill?.time?.toString() ?? "",
        distance: entered?.distance ?? prefill?.distance?.toString() ?? "",
      };
    },
    [workout, findLastAvailableSetData],
  );

  /** What a set shows: its entries, or the pre-fill from history. */
  const shownValues = useCallback(
    (exerciseIndex: number, setIndex: number) =>
      valuesFrom(weightAndReps, exerciseIndex, setIndex),
    [valuesFrom, weightAndReps],
  );

  // Read live: a value typed or corrected since this render counts.
  const liveValues = (exerciseIndex: number, setIndex: number) =>
    valuesFrom(
      useActiveWorkoutStore.getState().weightAndReps,
      exerciseIndex,
      setIndex,
    );

  const buildFeedbackContextForExercise = (
    exIdx: number,
    simulatedCompleted: CompletedSets,
  ): FeedbackPrompt | null => {
    if (!workout) return null;
    const exercise = workout.exercises[exIdx];
    if (!exercise?.id) return null;
    // Once feedback is submitted for this exercise, don't queue it again this
    // session (e.g. if the "all sets done" check below re-evaluates true via
    // a superset partner's later sets).
    if (feedbackSubmittedUweIds.includes(exercise.id)) return null;

    const trackingType = resolvedTrackingType(exercise);

    // Skip feedback for unsupported tracking types
    if (trackingType === "time" || trackingType === "distance") return null;

    // Read live: a confirmed weight correction lands in the store after this
    // render's snapshot was taken.
    const liveWeightAndReps = useActiveWorkoutStore.getState().weightAndReps;
    const workingSets = exercise.sets
      .map((set, idx) => ({ set, idx }))
      .filter(({ set }) => !set.isWarmup && !set.isDropSet);

    if (workingSets.length === 0) return null;

    // Skip feedback for reps-only exercises with no defined range
    if (trackingType === "reps") {
      const hasRange = workingSets.some(
        ({ set }) =>
          set.repsMin != null &&
          set.repsMax != null &&
          set.repsMin !== set.repsMax,
      );
      if (!hasRange) return null;
    }

    // Gate on every non-warmup set, including drop sets, so the sheet waits
    // until the whole exercise (drop sets included) is finished. The
    // performance/rep calculations below still use workingSets only, since
    // drop sets aren't part of the progression target.
    const allNonWarmupSets = exercise.sets
      .map((set, idx) => ({ set, idx }))
      .filter(({ set }) => !set.isWarmup);
    const allSetsDone = allNonWarmupSets.every(
      ({ idx }) => simulatedCompleted[exIdx]?.[idx] === true,
    );
    if (!allSetsDone) return null;

    // Use repsMin (the floor you must clear to be "on target") rather than
    // repsMax (the ceiling), so there's room between hitting the target and
    // maxing out the range for a reps-increase suggestion instead of jumping
    // straight to a load increase.
    const targetReps = workingSets.reduce(
      (sum, { set }) => sum + (set.repsMin ?? set.repsMax ?? 0),
      0,
    );
    const actualReps = workingSets.reduce((sum, { idx }) => {
      const r = parseInt(liveWeightAndReps[exIdx]?.[idx]?.reps ?? "0", 10);
      return sum + (isNaN(r) ? 0 : r);
    }, 0);
    const performanceRatio =
      targetReps > 0 ? Math.min(actualReps / targetReps, 1.5) : 1.0;

    const maxWeight = workingSets
      .map(({ idx }) =>
        parseFloat(liveWeightAndReps[exIdx]?.[idx]?.weight ?? ""),
      )
      .filter((w) => !isNaN(w));

    const completedRepsPerSet = workingSets.map(({ idx }) => {
      const r = parseInt(liveWeightAndReps[exIdx]?.[idx]?.reps ?? "", 10);
      return isNaN(r) ? null : r;
    });

    return {
      userWorkoutExerciseId: exercise.id,
      exerciseName: instanceName(workout.exercises, exIdx, exercise.name),
      performanceRatio,
      exerciseContext: {
        exerciseId: exercise.exercise_id,
        trackingType,
        equipment: exercise.equipment,
        currentSets: exercise.sets,
        // The inputs are in the display unit; the engine works in kg.
        recentWorkingWeight:
          maxWeight.length > 0
            ? displayToKg(Math.max(...maxWeight), weightUnit)
            : null,
        completedRepsPerSet,
      },
    };
  };

  const buildFeedbackContexts = (
    exerciseIndex: number,
    setIndex: number,
  ): FeedbackPrompt[] => {
    // Deload stays plan-only: isCurrentWeekDeload is false without a plan.
    if (
      !workout ||
      !progressionSettings.enabled ||
      !sessionSupportsProgression({
        workoutId: activeWorkout?.workoutId,
        isQuickWorkout,
      }) ||
      isCurrentWeekDeload
    )
      return [];

    const completedSets = useActiveWorkoutStore.getState().completedSets;
    const simulatedCompleted = {
      ...completedSets,
      [exerciseIndex]: {
        ...(completedSets[exerciseIndex] || {}),
        [setIndex]: true,
      },
    };

    const partnerIndex = workout.exercises[exerciseIndex]?.supersetGroupId
      ? findSupersetPartnerIndex(workout.exercises, exerciseIndex)
      : -1;
    if (partnerIndex === -1) {
      const ctx = buildFeedbackContextForExercise(
        exerciseIndex,
        simulatedCompleted,
      );
      return ctx ? [ctx] : [];
    }

    // Superset: only collect feedback once BOTH exercises have all working sets
    // done. Show first-in-superset first, then second, so the user answers in
    // the order they trained.
    const firstIdx = Math.min(exerciseIndex, partnerIndex);
    const secondIdx = Math.max(exerciseIndex, partnerIndex);
    const ctxFirst = buildFeedbackContextForExercise(
      firstIdx,
      simulatedCompleted,
    );
    const ctxSecond = buildFeedbackContextForExercise(
      secondIdx,
      simulatedCompleted,
    );
    if (!ctxFirst || !ctxSecond) return [];
    return [ctxFirst, ctxSecond];
  };

  /** Writes the set's values and checks for a PR; does not mark it done. */
  const writeSet = (
    exerciseIndex: number,
    setIndex: number,
    weightOverride?: string,
  ): PreparedSet => {
    // Captured before any state changes.
    const feedbackContexts = buildFeedbackContexts(exerciseIndex, setIndex);
    const shown = liveValues(exerciseIndex, setIndex);

    const weightNum = parseFloat(weightOverride ?? shown.weight);
    const weight = (isNaN(weightNum) ? 0 : weightNum).toString();
    const repsNum = parseInt(shown.reps);
    const reps = (isNaN(repsNum) ? 0 : repsNum).toString();

    const store = useActiveWorkoutStore.getState();
    store.updateWeightAndReps(
      exerciseIndex,
      setIndex,
      weight,
      reps,
      shown.time,
      shown.distance,
    );

    // Judged on the values just written, before the set is marked complete.
    const isPR = isSessionPR(
      prsWithSetCompleted(exerciseIndex, setIndex),
      exerciseIndex,
      setIndex,
    );
    if (isPR) Vibration.vibrate(PR_VIBRATION);

    // Completing a set during a rest ends that rest; any rest for this set
    // starts after.
    if (useActiveWorkoutStore.getState().timerRunning) {
      useActiveWorkoutStore.getState().endRestEarly();
      void cancelRestNotifications();
    }

    return {
      exerciseIndex,
      setIndex,
      weight,
      reps,
      time: shown.time,
      distance: shown.distance,
      isPR,
      feedbackContexts,
    };
  };

  /**
   * Checks the weight (asking about an implausible one), writes the values
   * and checks for a PR, then hands the set to `onPrepared` to mark it done.
   * Nothing happens when the user dismisses the weight question.
   */
  const prepareSet = (
    exerciseIndex: number,
    setIndex: number,
    onPrepared: (prepared: PreparedSet) => void,
  ) => {
    const exercise = workout?.exercises[exerciseIndex];
    if (!exercise?.sets[setIndex]) return;

    const trackingType = resolvedTrackingType(exercise);
    const enteredWeight = parseFloat(
      liveValues(exerciseIndex, setIndex).weight,
    );
    const confirmKey = `${exercise.exercise_id}:${enteredWeight}`;
    if (
      (trackingType === "weight" || trackingType === "assisted") &&
      !confirmedWeightsRef.current.has(confirmKey)
    ) {
      const reference = heaviestWorkingWeight([
        ...(prevExercisesByExerciseId.get(exercise.exercise_id) ?? []),
        ...(globalExercisesByExerciseId.get(exercise.exercise_id) ?? []),
      ]);
      const check = checkWeightPlausibility({
        weight: enteredWeight,
        reference,
        weightUnit,
      });
      if (check.implausible) {
        confirmImplausibleWeight({
          weight: enteredWeight,
          suggestion: check.suggestion,
          reference,
          weightUnit,
          onUse: (corrected) =>
            onPrepared(writeSet(exerciseIndex, setIndex, String(corrected))),
          onKeep: () => {
            confirmedWeightsRef.current.add(confirmKey);
            onPrepared(writeSet(exerciseIndex, setIndex));
          },
        });
        return;
      }
    }

    onPrepared(writeSet(exerciseIndex, setIndex));
  };

  /**
   * Completes a set where it is shown (overview row, list mode): marks it
   * done, records its duration when it was being timed, starts its rest and
   * queues any feedback card.
   */
  const completeSetInPlace = (
    exerciseIndex: number,
    setIndex: number,
    onDone?: (prepared: PreparedSet) => void,
  ) => {
    prepareSet(exerciseIndex, setIndex, (prepared) => {
      const store = useActiveWorkoutStore.getState();
      // Only the set the session was timing has a start; any other has no
      // duration.
      const timed =
        store.currentExerciseIndex === exerciseIndex &&
        (store.currentSetIndices[exerciseIndex] ?? 0) === setIndex &&
        store.currentSetStartedAt != null;
      const duration = timed
        ? Math.round(
            (Date.now() - new Date(store.currentSetStartedAt!).getTime()) /
              1000,
          )
        : null;
      store.recordSetDuration(exerciseIndex, setIndex, duration);
      if (timed) store.setCurrentSetStartedAt(null);

      store.completeSetAt(exerciseIndex, setIndex);

      const after = useActiveWorkoutStore.getState();
      const restSeconds = after.workout
        ? restAfterSetInPlace(
            after.workout.exercises,
            after.completedSets,
            exerciseIndex,
            setIndex,
          )
        : 0;
      if (restSeconds > 0) {
        const expiry = new Date(Date.now() + restSeconds * 1000);
        after.startTimer(expiry);
        void startRestNotification(
          restSeconds,
          t`Rest Timer Finished!`,
          t`Time to do your next set!`,
        );
      } else {
        void cancelRestNotifications();
      }

      after.queueFeedbackPrompts(prepared.feedbackContexts);

      const announcement = setCompleteAnnouncement(setIndex + 1, restSeconds);
      AccessibilityInfo.announceForAccessibility(
        prepared.isPR
          ? `${announcement} ${t`New personal record.`}`
          : announcement,
      );
      onDone?.(prepared);
    });
  };

  return {
    findLastAvailableSetData,
    shownValues,
    prepareSet,
    completeSetInPlace,
  };
}
