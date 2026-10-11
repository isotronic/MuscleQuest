import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator, Divider, Menu } from "react-native-paper";
import { router, Stack, useFocusEffect } from "expo-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AppButton, AppIconButton } from "@/components/ui";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { TimeInput } from "@/components/TimeInput";
import { DatePickerModal } from "@/components/history/DatePickerModal";
import type { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useExercisePickerStore } from "@/store/exercisePickerStore";
import { toLocalDateKey } from "@/utils/dates";
import {
  clockText,
  composeLocalMoment,
  EditableWorkout,
  parseClockMinutes,
} from "@/utils/historyEditOps";
import { formatFromTotalSeconds, convertToTotalSeconds } from "@/utils/utility";
import { parseDecimalInput, sanitizeIntegerInput } from "@/utils/numberFormat";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

type EditedExercise = CompletedWorkout["exercises"][number];
type EditedSet = EditedExercise["sets"][number];
type SetFlag = "is_warmup" | "is_drop_set" | "is_to_failure";

interface WorkoutHistoryEditorProps {
  initial: EditableWorkout;
  weightUnit: string;
  distanceUnit: string;
  /** Called with the edited workout, set values parsed, once it is valid. */
  onSave: (edited: EditableWorkout) => void;
  /** Receives the draft after every change, e.g. to carry it over a remount. */
  onChange?: (draft: EditableWorkout) => void;
  /** Rendered above the date row. */
  header?: React.ReactNode;
  /** Shows progress in place of the save button. */
  saving: boolean;
}

const emptySet = (setId: number, setNumber: number): EditedSet => ({
  set_id: setId,
  set_number: setNumber,
  weight: null,
  reps: null,
  time: null,
  distance: null,
  is_warmup: false,
  is_drop_set: false,
  is_to_failure: false,
  set_duration: null,
  note: null,
});

const decimalText = (value: number | null) =>
  value != null ? String(value) : "";

/**
 * Edits a saved workout, or one being logged after the fact: date, time,
 * duration, session note, exercises and sets. New exercises and sets get
 * negative ids until saved.
 */
export function WorkoutHistoryEditor({
  initial,
  weightUnit,
  distanceUnit,
  onSave,
  onChange,
  header,
  saving,
}: WorkoutHistoryEditorProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { i18n } = useLingui();

  const [exercises, setExercises] = useState<EditedExercise[]>(
    initial.exercises,
  );
  // Decimal fields are held as canonical text while typing ("62." must
  // survive a keystroke) and parsed on save. Keyed by set_id.
  const [weightInputs, setWeightInputs] = useState<Record<number, string>>(() =>
    seedInputs(initial.exercises, "weight"),
  );
  const [distanceInputs, setDistanceInputs] = useState<Record<number, string>>(
    () => seedInputs(initial.exercises, "distance"),
  );
  const initialDate = toLocalDateKey(initial.completedAt);
  const initialTime = clockText(
    initial.completedAt.getHours() * 60 + initial.completedAt.getMinutes(),
  );
  const initialDuration = clockText(Math.floor(initial.durationSeconds / 60));
  const [localDate, setLocalDate] = useState(initialDate);
  const [timeText, setTimeText] = useState(initialTime);
  const [durationText, setDurationText] = useState(initialDuration);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [menuSetId, setMenuSetId] = useState<number | null>(null);

  // Below every id already in use, as a prefilled draft holds negative ones.
  const nextTempId = useRef(lowestId(initial.exercises) - 1);
  const tempId = () => nextTempId.current--;

  const timeMinutes = parseClockMinutes(timeText);
  const timeError =
    timeMinutes == null || timeMinutes >= 24 * 60
      ? t`Enter a time between 0:00 and 23:59.`
      : null;
  // The calendar stops at today, so only a later time today can be future.
  const completedAt = useMemo(
    () =>
      localDate === initialDate && timeText === initialTime
        ? initial.completedAt
        : composeLocalMoment(localDate, timeMinutes ?? 0),
    [localDate, timeText, timeMinutes, initialDate, initialTime, initial],
  );
  const futureError =
    !timeError && completedAt.getTime() > Date.now()
      ? t`That time is still to come. Pick a time that has passed.`
      : null;
  const durationMinutes = parseClockMinutes(durationText);
  const durationSeconds =
    durationText === initialDuration
      ? initial.durationSeconds
      : (durationMinutes ?? 0) * 60;

  const buildDraft = useCallback(
    (): EditableWorkout => ({
      exercises: exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          weight: parseDecimalInput(weightInputs[set.set_id] ?? ""),
          distance: parseDecimalInput(distanceInputs[set.set_id] ?? ""),
        })),
      })),
      completedAt,
      durationSeconds,
      notes: notes.trim() ? notes : null,
    }),
    [
      exercises,
      weightInputs,
      distanceInputs,
      completedAt,
      durationSeconds,
      notes,
    ],
  );

  useEffect(() => {
    onChange?.(buildDraft());
  }, [buildDraft, onChange]);

  const handleSave = () => {
    if (timeError || futureError) {
      Alert.alert(t`Check the time`, timeError ?? futureError ?? "");
      return;
    }
    const draft = buildDraft();
    // An exercise left with no sets is dropped from the workout.
    draft.exercises = draft.exercises.filter((e) => e.sets.length > 0);
    if (draft.exercises.length === 0) {
      Alert.alert(t`No sets`, t`Add at least one set to save this workout.`);
      return;
    }
    onSave(draft);
  };

  // Exercise picker round trip: which exercise to swap, or a new one to add.
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "replace"; completedExerciseId: number } | { kind: "add" } | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      const picked = useExercisePickerStore.getState().pickedExercise;
      if (!picked || !pickerTarget) return;
      const details = {
        exercise_id: picked.exercise_id,
        exercise_name: picked.name,
        exercise_image: picked.image,
        exercise_image_uri: picked.image_uri,
        exercise_tracking_type: picked.tracking_type || "weight",
        is_unilateral: picked.is_unilateral,
        double_weight: picked.double_weight,
      };
      if (pickerTarget.kind === "replace") {
        setExercises((prev) =>
          prev.map((exercise) =>
            exercise.completed_exercise_id === pickerTarget.completedExerciseId
              ? { ...exercise, ...details }
              : exercise,
          ),
        );
      } else {
        const setId = tempId();
        setExercises((prev) => [
          ...prev,
          {
            completed_exercise_id: tempId(),
            ...details,
            sets: [emptySet(setId, 1)],
          },
        ]);
      }
      useExercisePickerStore.getState().clearPickedExercise();
      setPickerTarget(null);
    }, [pickerTarget]),
  );

  const openPicker = (
    target: NonNullable<typeof pickerTarget>,
    trackingType?: string,
  ) => {
    setPickerTarget(target);
    router.push({
      pathname: "/(app)/exercise-library",
      params: trackingType
        ? { mode: "select", trackingType }
        : { mode: "select" },
    });
  };

  const updateExercise = (
    exerciseIndex: number,
    update: (exercise: EditedExercise) => EditedExercise,
  ) =>
    setExercises((prev) =>
      prev.map((exercise, i) =>
        i === exerciseIndex ? update(exercise) : exercise,
      ),
    );

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<EditedSet>,
  ) =>
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, j) =>
        j === setIndex ? { ...set, ...patch } : set,
      ),
    }));

  const addSet = (exerciseIndex: number) => {
    const setId = tempId();
    const last = exercises[exerciseIndex].sets.at(-1);
    if (last) {
      setWeightInputs((prev) => ({
        ...prev,
        [setId]: prev[last.set_id] ?? "",
      }));
      setDistanceInputs((prev) => ({
        ...prev,
        [setId]: prev[last.set_id] ?? "",
      }));
    }
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          ...emptySet(setId, exercise.sets.length + 1),
          reps: last?.reps ?? null,
          time: last?.time ?? null,
        },
      ],
    }));
  };

  const removeSet = (exerciseIndex: number, setIndex: number) =>
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      // Numbered by position, as they will be saved.
      sets: exercise.sets
        .filter((_, j) => j !== setIndex)
        .map((set, j) => ({ ...set, set_number: j + 1 })),
    }));

  const removeExercise = (exercise: EditedExercise) => {
    const name = exercise.exercise_name;
    Alert.alert(
      t`Remove exercise?`,
      t`${name} and its sets come out of this workout when you save.`,
      [
        { text: t`Keep`, style: "cancel" },
        {
          text: t`Remove`,
          style: "destructive",
          onPress: () =>
            setExercises((prev) =>
              prev.filter(
                (e) =>
                  e.completed_exercise_id !== exercise.completed_exercise_id,
              ),
            ),
        },
      ],
    );
  };

  const flagLabels: Record<SetFlag, string> = {
    is_warmup: t`Warm-up`,
    is_drop_set: t`Drop set`,
    is_to_failure: t`To failure`,
  };
  const flags: SetFlag[] = ["is_warmup", "is_drop_set", "is_to_failure"];

  const formattedDate = composeLocalMoment(localDate, 0).toLocaleDateString(
    i18n.locale,
    { weekday: "short", day: "numeric", month: "short", year: "numeric" },
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          headerRight: () =>
            saving ? (
              <ActivityIndicator
                size={24}
                color={colors.accent}
                style={styles.saving}
              />
            ) : (
              <AppIconButton
                accessibilityLabel={t`Save changes`}
                icon="content-save-outline"
                size={35}
                style={styles.saveButton}
                iconColor={colors.accent}
                onPressIn={handleSave}
              />
            ),
        }}
      />
      {header}
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>
          <Trans>Date</Trans>
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t`Date, ${formattedDate}`}
          accessibilityHint={t`Opens a calendar`}
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <ThemedText style={styles.dateText}>{formattedDate}</ThemedText>
        </Pressable>
      </View>
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>
          <Trans>Finished at</Trans>
        </ThemedText>
        <TimeInput
          accessibilityLabel={t`Finished at`}
          fields="hoursMinutes"
          value={timeText}
          onChange={setTimeText}
          style={styles.timeInput}
        />
      </View>
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>
          <Trans>Duration</Trans>
        </ThemedText>
        <TimeInput
          accessibilityLabel={t`Duration`}
          fields="hoursMinutes"
          value={durationText}
          onChange={setDurationText}
          style={styles.timeInput}
        />
      </View>
      {!!(timeError || futureError) && (
        <ThemedText style={styles.error} accessibilityLiveRegion="polite">
          {timeError ?? futureError}
        </ThemedText>
      )}
      <TextInput
        accessibilityLabel={t`Session note`}
        style={[styles.input, styles.noteInput]}
        placeholder={t`Session note`}
        placeholderTextColor={colors.contentSecondary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Divider style={styles.sectionDivider} />

      {exercises.map((exercise, exerciseIndex) => (
        <ThemedView
          key={exercise.completed_exercise_id}
          style={styles.exerciseContainer}
        >
          <View style={styles.exerciseHeader}>
            <ThemedText style={styles.exerciseName}>
              {exercise.exercise_name}
            </ThemedText>
            <AppIconButton
              accessibilityLabel={t`Change exercise ${exercise.exercise_name}`}
              icon="pencil-outline"
              size={20}
              onPress={() =>
                openPicker(
                  {
                    kind: "replace",
                    completedExerciseId: exercise.completed_exercise_id,
                  },
                  exercise.exercise_tracking_type,
                )
              }
            />
            <AppIconButton
              accessibilityLabel={t`Remove exercise ${exercise.exercise_name}`}
              icon="trash-can-outline"
              size={20}
              iconColor={colors.danger}
              onPress={() => removeExercise(exercise)}
            />
          </View>
          {exercise.sets.map((set, setIndex) => {
            const setFlags = flags.filter((flag) => set[flag]);
            return (
              <ThemedView key={set.set_id} style={styles.setContainer}>
                <View style={styles.setHeader}>
                  <View style={styles.setTitle}>
                    <ThemedText style={styles.setNumber}>
                      <Trans>Set {set.set_number}</Trans>
                    </ThemedText>
                    {setFlags.length > 0 && (
                      <ThemedText style={styles.setFlags}>
                        {setFlags.map((flag) => flagLabels[flag]).join(" · ")}
                      </ThemedText>
                    )}
                  </View>
                  <Menu
                    visible={menuSetId === set.set_id}
                    onDismiss={() => setMenuSetId(null)}
                    anchor={
                      <AppIconButton
                        accessibilityLabel={t`Set type, set ${set.set_number}`}
                        icon="tag-outline"
                        size={20}
                        onPress={() => setMenuSetId(set.set_id)}
                      />
                    }
                  >
                    {flags.map((flag) => (
                      <Menu.Item
                        key={flag}
                        title={flagLabels[flag]}
                        leadingIcon={
                          set[flag]
                            ? "checkbox-marked-outline"
                            : "checkbox-blank-outline"
                        }
                        accessibilityState={{ checked: !!set[flag] }}
                        onPress={() =>
                          updateSet(exerciseIndex, setIndex, {
                            [flag]: !set[flag],
                          })
                        }
                      />
                    ))}
                  </Menu>
                  <AppIconButton
                    accessibilityLabel={t`Remove set ${set.set_number}`}
                    icon="close"
                    size={20}
                    onPress={() => removeSet(exerciseIndex, setIndex)}
                  />
                </View>
                <Divider style={styles.divider} />
                <SetValueInputs
                  trackingType={exercise.exercise_tracking_type}
                  set={set}
                  weightUnit={weightUnit}
                  distanceUnit={distanceUnit}
                  weight={weightInputs[set.set_id] ?? ""}
                  distance={distanceInputs[set.set_id] ?? ""}
                  onWeight={(value) =>
                    setWeightInputs((prev) => ({
                      ...prev,
                      [set.set_id]: value,
                    }))
                  }
                  onDistance={(value) =>
                    setDistanceInputs((prev) => ({
                      ...prev,
                      [set.set_id]: value,
                    }))
                  }
                  onPatch={(patch) => updateSet(exerciseIndex, setIndex, patch)}
                  styles={styles}
                  colors={colors}
                />
                <TextInput
                  accessibilityLabel={t`Note, set ${set.set_number}`}
                  style={[styles.input, styles.setNoteInput]}
                  placeholder={t`Set note`}
                  placeholderTextColor={colors.contentSecondary}
                  value={set.note ?? ""}
                  onChangeText={(note) =>
                    updateSet(exerciseIndex, setIndex, { note })
                  }
                />
              </ThemedView>
            );
          })}
          <AppButton
            variant="ghost"
            accessibilityLabel={t`Add set to ${exercise.exercise_name}`}
            onPress={() => addSet(exerciseIndex)}
          >
            <Trans>Add set</Trans>
          </AppButton>
        </ThemedView>
      ))}
      <AppButton
        variant="secondary"
        onPress={() => openPicker({ kind: "add" })}
      >
        <Trans>Add exercise</Trans>
      </AppButton>
      <DatePickerModal
        visible={showDatePicker}
        value={localDate}
        onDismiss={() => setShowDatePicker(false)}
        onChange={setLocalDate}
      />
    </ScrollView>
  );
}

function lowestId(exercises: EditedExercise[]): number {
  let lowest = 0;
  for (const exercise of exercises) {
    lowest = Math.min(lowest, exercise.completed_exercise_id);
    for (const set of exercise.sets) lowest = Math.min(lowest, set.set_id);
  }
  return lowest;
}

function seedInputs(
  exercises: EditedExercise[],
  field: "weight" | "distance",
): Record<number, string> {
  const inputs: Record<number, string> = {};
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      inputs[set.set_id] = decimalText(set[field]);
    }
  }
  return inputs;
}

interface SetValueInputsProps {
  trackingType: string;
  set: EditedSet;
  weightUnit: string;
  distanceUnit: string;
  weight: string;
  distance: string;
  onWeight: (value: string) => void;
  onDistance: (value: string) => void;
  onPatch: (patch: Partial<EditedSet>) => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppThemeColors;
}

function SetValueInputs({
  trackingType,
  set,
  weightUnit,
  distanceUnit,
  weight,
  distance,
  onWeight,
  onDistance,
  onPatch,
  styles,
  colors,
}: SetValueInputsProps) {
  const repsInput = (
    <View style={styles.inputContainer}>
      <ThemedText style={styles.label}>
        <Trans>Reps</Trans>
      </ThemedText>
      <TextInput
        accessibilityLabel={t`Reps, set ${set.set_number}`}
        style={styles.input}
        placeholder={t`Reps`}
        value={String(set.reps || "")}
        placeholderTextColor={colors.contentSecondary}
        selectTextOnFocus={true}
        keyboardType="number-pad"
        onChangeText={(value: string) => {
          const digits = sanitizeIntegerInput(value);
          onPatch({ reps: digits === "" ? null : Number(digits) });
        }}
      />
    </View>
  );

  if (trackingType === "weight" || trackingType === "assisted") {
    return (
      <View>
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>
            {trackingType === "weight" ? (
              <Trans>Weight</Trans>
            ) : (
              <Trans>Assist</Trans>
            )}{" "}
            ({weightUnit})
          </ThemedText>
          <DecimalInput
            accessibilityLabel={
              trackingType === "weight"
                ? t`Weight in ${weightUnit}, set ${set.set_number}`
                : t`Assistance in ${weightUnit}, set ${set.set_number}`
            }
            style={styles.input}
            placeholder={t`Weight`}
            value={weight}
            placeholderTextColor={colors.contentSecondary}
            selectTextOnFocus={true}
            onChangeValue={onWeight}
          />
        </View>
        {repsInput}
      </View>
    );
  }
  if (trackingType === "time") {
    return (
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>
          <Trans>Time (Min:Sec)</Trans>
        </ThemedText>
        <TimeInput
          accessibilityLabel={t`Time, set ${set.set_number}`}
          value={formatFromTotalSeconds(set.time || 0)}
          onChange={(value: string) =>
            onPatch({ time: convertToTotalSeconds(value) })
          }
          style={styles.timeInput}
        />
      </View>
    );
  }
  if (trackingType === "reps") return repsInput;
  if (trackingType === "distance") {
    return (
      <View style={styles.inputContainer}>
        <ThemedText style={styles.label}>
          <Trans>Distance ({distanceUnit})</Trans>
        </ThemedText>
        <DecimalInput
          accessibilityLabel={t`Distance in ${distanceUnit}, set ${set.set_number}`}
          style={styles.input}
          placeholder={t`Distance`}
          value={distance}
          placeholderTextColor={colors.contentSecondary}
          selectTextOnFocus={true}
          onChangeValue={onDistance}
        />
      </View>
    );
  }
  return null;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, paddingBottom: 48 },
    exerciseContainer: { marginBottom: 16 },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    exerciseName: { flex: 1, fontSize: 20, fontWeight: "bold" },
    setContainer: { marginBottom: 8 },
    setHeader: { flexDirection: "row", alignItems: "center" },
    setTitle: { flex: 1 },
    setNumber: { fontWeight: "bold" },
    setFlags: { fontSize: 13, color: colors.contentSecondary },
    divider: { marginBottom: 8 },
    sectionDivider: { marginVertical: 16 },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 8,
    },
    label: {
      width: 120,
      marginRight: 10,
    },
    input: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "right",
    },
    noteInput: { textAlign: "left", fontSize: 16, minHeight: 48 },
    setNoteInput: { textAlign: "left", fontSize: 15, flex: 0 },
    timeInput: {
      width: 96,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
      color: colors.contentPrimary,
      fontSize: 18,
      textAlign: "center",
    },
    dateButton: {
      flex: 1,
      padding: 10,
      borderColor: colors.contentSecondary,
      borderWidth: 1,
      borderRadius: radii.md,
    },
    dateText: { fontSize: 18, textAlign: "right" },
    error: { color: colors.danger, marginBottom: 8 },
    saving: { marginRight: 12 },
    saveButton: { marginRight: 0 },
  });
}
