import React, { useMemo, useRef } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import RestTimerOverlay from "@/components/RestTimerOverlay";
import { ListSetHeader, ListSetRow } from "@/components/workout/ListSetRow";
import {
  QueuedFeedbackCard,
  useHasQueuedFeedback,
} from "@/components/workout/QueuedFeedbackCard";
import type { PreviousSet } from "@/components/LastTimeLine";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompleteSet, type SetValues } from "@/hooks/useCompleteSet";
import { useSessionPRs } from "@/hooks/useSessionPRs";
import { useRestTimerControls } from "@/hooks/useRestTimerControls";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useWorkoutImmersiveMode } from "@/hooks/useWorkoutImmersiveMode";
import { findSupersetPartnerIndex } from "@/utils/supersetUtils";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { instanceName } from "@/utils/exerciseInstance";
import { listRows, type ListRow } from "@/utils/listLogging";
import { isSessionPR } from "@/utils/sessionPRs";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const FEEDBACK_CARD_MAX_HEIGHT = Dimensions.get("window").height * 0.25;

type RowRef = ListRow;

/**
 * The list logging mode: every set of an exercise (or superset) with inline
 * inputs. Completing a row uses the same path as the focus screen, and focus
 * moves to the next open row instead of changing screens.
 */
export default function ExerciseListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ exerciseIndex: string }>();
  const exerciseIndex = Number(params.exerciseIndex);
  const { workout, completedSets } = useActiveWorkoutStore(
    useShallow((s) => ({
      workout: s.workout,
      completedSets: s.completedSets,
    })),
  );
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const { shownValues, findLastAvailableSetData, completeSetInPlace } =
    useCompleteSet();
  const { prs: sessionPRs } = useSessionPRs();
  const restTimer = useRestTimerControls();
  const hasQueuedFeedback = useHasQueuedFeedback();
  useKeepScreenOn();
  useWorkoutImmersiveMode();

  const inputRefs = useRef(new Map<string, TextInput | null>());

  const exercises = workout?.exercises ?? [];
  const exercise = exercises[exerciseIndex];
  const partnerIndex = exercise?.supersetGroupId
    ? findSupersetPartnerIndex(exercises, exerciseIndex)
    : -1;
  const indices =
    partnerIndex === -1
      ? [exerciseIndex]
      : [
          Math.min(exerciseIndex, partnerIndex),
          Math.max(exerciseIndex, partnerIndex),
        ];
  const rows = exercise
    ? listRows(
        indices.map((i) => exercises[i].sets.length),
        indices,
      )
    : [];
  const isSuperset = indices.length > 1;
  const title = !exercise
    ? ""
    : isSuperset
      ? t`Superset`
      : instanceName(exercises, exerciseIndex, exercise.name);

  const isDone = (row: RowRef) =>
    completedSets[row.exerciseIndex]?.[row.setIndex] === true;
  const rowKey = (row: RowRef) => `${row.exerciseIndex}:${row.setIndex}`;

  const focusNextOpenRow = (fromPosition: number) => {
    const live = useActiveWorkoutStore.getState().completedSets;
    for (let i = fromPosition + 1; i < rows.length; i++) {
      const row = rows[i];
      if (live[row.exerciseIndex]?.[row.setIndex] === true) continue;
      inputRefs.current.get(rowKey(row))?.focus();
      return;
    }
    // Nothing left to type into: let the keyboard go.
    inputRefs.current.forEach((input) => input?.blur());
  };

  const handleChange = (row: RowRef, field: keyof SetValues, value: string) => {
    const values = { ...shownValues(row.exerciseIndex, row.setIndex) };
    values[field] = value;
    useActiveWorkoutStore
      .getState()
      .updateWeightAndReps(
        row.exerciseIndex,
        row.setIndex,
        values.weight,
        values.reps,
        values.time,
        values.distance,
      );
  };

  const lastTimeFor = (row: RowRef): PreviousSet | null => {
    const ex = exercises[row.exerciseIndex];
    const match = findLastAvailableSetData(
      ex.exercise_id,
      row.setIndex,
      row.exerciseIndex,
    );
    return match
      ? {
          weight: match.weight,
          reps: match.reps,
          time: match.time,
          distance: match.distance,
        }
      : null;
  };

  if (!exercise) {
    return (
      <ThemedView style={styles.empty}>
        <Stack.Screen options={{ title: "" }} />
        <ThemedText>
          <Trans>This exercise is no longer in the workout.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  // One tracking type for the column titles; a superset of two types still
  // shows each row's own inputs.
  const headerTrackingType = resolvedTrackingType(exercise);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            restTimer.timerRunning && styles.contentResting,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {isSuperset && (
            <ThemedText style={styles.supersetNames}>
              {indices
                .map((i) => instanceName(exercises, i, exercises[i].name))
                .join(" + ")}
            </ThemedText>
          )}
          {hasQueuedFeedback && !restTimer.timerRunning && (
            <View style={styles.feedbackCard}>
              <QueuedFeedbackCard />
            </View>
          )}
          <ListSetHeader
            trackingType={headerTrackingType}
            weightUnit={weightUnit}
            distanceUnit={distanceUnit}
          />
          {rows.map((row, position) => {
            const ex = exercises[row.exerciseIndex];
            const key = rowKey(row);
            return (
              <ListSetRow
                key={key}
                ref={(input) => {
                  inputRefs.current.set(key, input);
                }}
                title={
                  isSuperset
                    ? instanceName(exercises, row.exerciseIndex, ex.name)
                    : String(row.setIndex + 1)
                }
                setNumber={row.setIndex + 1}
                set={ex.sets[row.setIndex]}
                trackingType={resolvedTrackingType(ex)}
                values={shownValues(row.exerciseIndex, row.setIndex)}
                lastTime={lastTimeFor(row)}
                completed={isDone(row)}
                isPR={isSessionPR(sessionPRs, row.exerciseIndex, row.setIndex)}
                weightUnit={weightUnit}
                distanceUnit={distanceUnit}
                onChange={(field, value) => handleChange(row, field, value)}
                onComplete={() =>
                  completeSetInPlace(row.exerciseIndex, row.setIndex, () =>
                    focusNextOpenRow(position),
                  )
                }
                onSubmitLast={() => focusNextOpenRow(position)}
              />
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
      <RestTimerOverlay
        minutes={restTimer.minutes}
        seconds={restTimer.seconds}
        increment={restTimer.increment}
        timerRunning={restTimer.timerRunning}
        animStyle={restTimer.animStyle}
        buttonSize={restTimer.buttonSize}
        onAdjust={(delta) => void restTimer.adjust(delta)}
        onSkip={restTimer.skip}
        topContent={
          restTimer.timerRunning && hasQueuedFeedback ? (
            <ScrollView
              style={styles.feedbackCardScroll}
              keyboardShouldPersistTaps="handled"
            >
              <QueuedFeedbackCard />
            </ScrollView>
          ) : null
        }
      />
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    content: {
      padding: 12,
      paddingBottom: 24,
    },
    // Room for the rest overlay over the last rows.
    contentResting: {
      paddingBottom: 220,
    },
    supersetNames: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.contentPrimary,
      marginBottom: 8,
    },
    feedbackCard: {
      marginBottom: 12,
    },
    feedbackCardScroll: {
      flexGrow: 0,
      maxHeight: FEEDBACK_CARD_MAX_HEIGHT,
    },
  });
}
