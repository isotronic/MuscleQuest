import React, { useEffect, useMemo, useRef } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button } from "react-native-paper";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import RestTimerOverlay from "@/components/RestTimerOverlay";
import WorkoutTimer from "@/components/WorkoutTimer";
import { Cues } from "@/components/Cues";
import { ListSetHeader, ListSetRow } from "@/components/workout/ListSetRow";
import { ExerciseSessionHeader } from "@/components/workout/ExerciseSessionHeader";
import {
  QueuedFeedbackCard,
  useHasQueuedFeedback,
} from "@/components/workout/QueuedFeedbackCard";
import type { PreviousSet } from "@/components/LastTimeLine";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import type { UserExercise } from "@/store/workoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompleteSet, type SetValues } from "@/hooks/useCompleteSet";
import { useSessionPRs } from "@/hooks/useSessionPRs";
import { useRestTimerControls } from "@/hooks/useRestTimerControls";
import { useAnimatedImageQuery } from "@/hooks/useAnimatedImageQuery";
import useKeepScreenOn from "@/hooks/useKeepScreenOn";
import { useWorkoutImmersiveMode } from "@/hooks/useWorkoutImmersiveMode";
import { findSupersetPartnerIndex } from "@/utils/supersetUtils";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { instanceName } from "@/utils/exerciseInstance";
import { isSessionPR } from "@/utils/sessionPRs";
import { adjacentGroup, listRows, type ListRow } from "@/utils/listLogging";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const FEEDBACK_CARD_MAX_HEIGHT = Dimensions.get("window").height * 0.25;

/** The focus screen's header for one exercise, its targets from the first
 * working set. */
function ListExerciseHeader({
  exercise,
  name,
  distanceUnit,
  compact,
}: {
  exercise: UserExercise;
  name: string;
  distanceUnit: string;
  compact: boolean;
}) {
  const {
    data: animatedUrl,
    error,
    isLoading,
  } = useAnimatedImageQuery(
    exercise.exercise_id,
    exercise.animated_url || "",
    exercise.local_animated_uri,
  );
  const target =
    exercise.sets.find((s) => !s.isWarmup && !s.isDropSet) ?? exercise.sets[0];
  return (
    <ExerciseSessionHeader
      exerciseId={exercise.exercise_id}
      exerciseName={name}
      animatedUrl={animatedUrl ?? undefined}
      animatedImageLoading={isLoading}
      animatedImageError={error}
      trackingType={resolvedTrackingType(exercise)}
      repsMin={target?.repsMin}
      repsMax={target?.repsMax}
      timeMin={target?.time}
      distanceMin={target?.distance}
      distanceUnit={distanceUnit}
      restMinutes={target?.restMinutes ?? 0}
      restSeconds={target?.restSeconds ?? 0}
      compact={compact}
    />
  );
}

/**
 * The list logging mode: every set of an exercise (or superset) with inline
 * inputs. Completing a row uses the same path as the focus screen, and focus
 * moves to the next open row instead of changing screens. Previous and Next
 * move between exercises in overview order.
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
  const leadIndex = indices[0];
  const rows = exercise
    ? listRows(
        indices.map((i) => exercises[i].sets.length),
        indices,
      )
    : [];
  const isSuperset = indices.length > 1;
  const nameOf = (i: number) => instanceName(exercises, i, exercises[i].name);
  const groupName = (group: number[]) => group.map(nameOf).join(" + ");

  // The session follows the exercise on screen, as on the focus screen, so
  // set timing and the overview's next set stay right.
  const setCurrentExerciseIndex = useActiveWorkoutStore(
    (s) => s.setCurrentExerciseIndex,
  );
  const hasExercise = !!exercise;
  useEffect(() => {
    if (hasExercise) setCurrentExerciseIndex(leadIndex);
  }, [hasExercise, leadIndex, setCurrentExerciseIndex]);

  const isDone = (row: ListRow) =>
    completedSets[row.exerciseIndex]?.[row.setIndex] === true;
  const rowKey = (row: ListRow) => `${row.exerciseIndex}:${row.setIndex}`;
  const allDone = rows.length > 0 && rows.every(isDone);

  const focusNextOpenRow = (fromPosition: number) => {
    const live = useActiveWorkoutStore.getState().completedSets;
    for (let i = fromPosition + 1; i < rows.length; i++) {
      const row = rows[i];
      if (live[row.exerciseIndex]?.[row.setIndex] === true) continue;
      const input = inputRefs.current.get(rowKey(row));
      if (!input) continue;
      input.focus();
      return;
    }
    // Nothing left to type into: let the keyboard go.
    inputRefs.current.forEach((input) => input?.blur());
  };

  const handleChange = (
    row: ListRow,
    field: keyof SetValues,
    value: string,
  ) => {
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

  const lastTimeFor = (row: ListRow): PreviousSet | null => {
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
        <ThemedText>
          <Trans>This exercise is no longer in the workout.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const previous = adjacentGroup(exercises, exerciseIndex, -1);
  const next = adjacentGroup(exercises, exerciseIndex, 1);
  const goTo = (group: number[]) => {
    inputRefs.current.forEach((input) => input?.blur());
    router.setParams({ exerciseIndex: String(group[0]) });
  };
  const nextName = next ? groupName(next) : "";
  const previousName = previous ? groupName(previous) : "";

  // One tracking type for the column titles; a superset of two types still
  // shows each row's own inputs.
  const headerTrackingType = resolvedTrackingType(exercise);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <>
              <Cues
                noteType="exercise"
                referenceId={exercises[leadIndex].exercise_id}
                buttonType="icon"
              />
              <WorkoutTimer />
            </>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          // A new exercise starts at the top.
          key={leadIndex}
          contentContainerStyle={[
            styles.content,
            restTimer.timerRunning && styles.contentResting,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {isSuperset && (
            <View style={styles.supersetBanner}>
              <ThemedText style={styles.supersetLabel}>
                <Trans>Superset</Trans>
              </ThemedText>
            </View>
          )}
          <View style={styles.headers}>
            {indices.map((i) => (
              <ListExerciseHeader
                key={i}
                exercise={exercises[i]}
                name={nameOf(i)}
                distanceUnit={distanceUnit}
                compact={isSuperset}
              />
            ))}
          </View>
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
                    ? nameOf(row.exerciseIndex)
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
          <View style={styles.footer}>
            {previous && (
              <Button
                mode="outlined"
                icon="chevron-left"
                onPress={() => goTo(previous)}
                style={styles.previousButton}
                contentStyle={styles.buttonContent}
                accessibilityLabel={t`Previous exercise: ${previousName}`}
              >
                <Trans>Previous</Trans>
              </Button>
            )}
            <Button
              // Leads once this exercise is done.
              mode={allDone ? "contained" : "outlined"}
              icon={next ? "chevron-right" : "format-list-bulleted"}
              onPress={() => (next ? goTo(next) : router.back())}
              style={styles.nextButton}
              contentStyle={[styles.buttonContent, styles.nextButtonContent]}
            >
              {next ? t`Next: ${nextName}` : t`Back to overview`}
            </Button>
          </View>
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
      padding: 16,
      paddingBottom: 24,
    },
    // Room for the rest overlay over the last rows.
    contentResting: {
      paddingBottom: 220,
    },
    headers: {
      gap: 12,
      marginBottom: 20,
    },
    supersetBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 12,
    },
    supersetLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    feedbackCard: {
      marginBottom: 12,
    },
    feedbackCardScroll: {
      flexGrow: 0,
      maxHeight: FEEDBACK_CARD_MAX_HEIGHT,
    },
    footer: {
      flexDirection: "row",
      gap: 8,
      marginTop: 20,
    },
    previousButton: {
      borderRadius: radii.md,
    },
    nextButton: {
      flex: 1,
      borderRadius: radii.md,
    },
    buttonContent: {
      minHeight: 50,
    },
    // The icon follows the label, pointing where the button goes.
    nextButtonContent: {
      flexDirection: "row-reverse",
    },
  });
}
