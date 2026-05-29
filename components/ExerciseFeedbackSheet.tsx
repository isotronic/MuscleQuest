import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Button } from "react-native-paper";
import { AppBottomSheet } from "@/components/ui/AppBottomSheet";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import {
  EffortRating,
  ExerciseFeedbackPayload,
  PainFlag,
} from "@/types/progression";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

interface ExerciseFeedbackSheetProps {
  exerciseName: string;
  userWorkoutExerciseId: number;
  performanceRatio: number;
  onSubmit: (payload: ExerciseFeedbackPayload) => void;
}

function getEffortOptions(): { value: EffortRating; label: string }[] {
  return [
    { value: "easy", label: t`Easy, could do more` },
    { value: "moderate", label: t`About right` },
    { value: "hard", label: t`Hard, near limit` },
    { value: "failed", label: t`Couldn't finish all sets` },
  ];
}

function getPainOptions(): { value: PainFlag; label: string }[] {
  return [
    { value: "none", label: t`No pain` },
    { value: "discomfort", label: t`Minor discomfort` },
    { value: "pain", label: t`Pain or form issues` },
  ];
}

function OptionChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: AppThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.optionChip,
        {
          backgroundColor: selected ? colors.accent : colors.surfaceHighlight,
          borderColor: selected ? colors.accent : colors.accentBorder,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.optionLabel,
          { color: selected ? colors.onAccent : colors.contentPrimary },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const ExerciseFeedbackSheet = React.forwardRef<
  BottomSheetModal,
  ExerciseFeedbackSheetProps
>(function ExerciseFeedbackSheet(
  { exerciseName, userWorkoutExerciseId, performanceRatio, onSubmit },
  ref,
) {
  const { colors } = useAppTheme();
  const [effortRating, setEffortRating] = useState<EffortRating | null>(null);
  const [painFlag, setPainFlag] = useState<PainFlag | null>(null);
  const [progressionIntent, setProgressionIntent] = useState<
    "progress" | "hold" | null
  >(null);
  const [painNotes, setPainNotes] = useState("");

  const reset = useCallback(() => {
    setEffortRating(null);
    setPainFlag(null);
    setProgressionIntent(null);
    setPainNotes("");
  }, []);

  const handleDismiss = useCallback(() => {
    reset();
  }, [reset]);

  const canSubmit = effortRating !== null && painFlag !== null;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    const payload: ExerciseFeedbackPayload = {
      userWorkoutExerciseId,
      effortRating: effortRating!,
      painFlag: painFlag!,
      progressionIntent: progressionIntent ?? undefined,
      performanceRatio,
      notes: painNotes.trim() || undefined,
    };

    reset();
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    onSubmit(payload);
  }, [
    canSubmit,
    userWorkoutExerciseId,
    effortRating,
    painFlag,
    progressionIntent,
    performanceRatio,
    painNotes,
    reset,
    ref,
    onSubmit,
  ]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
      />
    ),
    [],
  );

  return (
    <AppBottomSheet
      ref={ref}
      snapPoints={["62%", "90%"]}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
    >
      <BottomSheetView>
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText style={styles.title}>{exerciseName}</ThemedText>

          <ThemedText style={styles.question}>
            <Trans>How did that feel?</Trans>
          </ThemedText>
          <View style={styles.optionsGrid}>
            {getEffortOptions().map((opt) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                selected={effortRating === opt.value}
                onPress={() => {
                  setEffortRating(opt.value);
                  if (opt.value !== "easy") setProgressionIntent(null);
                }}
                colors={colors}
              />
            ))}
          </View>

          <ThemedText style={styles.question}>
            <Trans>Any pain or form breakdown?</Trans>
          </ThemedText>
          <View style={styles.optionsRow}>
            {getPainOptions().map((opt) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                selected={painFlag === opt.value}
                onPress={() => {
                  setPainFlag(opt.value);
                  if (opt.value !== "pain") setPainNotes("");
                }}
                colors={colors}
              />
            ))}
          </View>

          {effortRating === "easy" && (
            <>
              <ThemedText style={styles.question}>
                <Trans>Push harder next time?</Trans>
              </ThemedText>
              <View style={styles.optionsRow}>
                <OptionChip
                  label={t`Yes, increase the challenge`}
                  selected={progressionIntent === "progress"}
                  onPress={() => setProgressionIntent("progress")}
                  colors={colors}
                />
                <OptionChip
                  label={t`No, keep it the same`}
                  selected={progressionIntent === "hold"}
                  onPress={() => setProgressionIntent("hold")}
                  colors={colors}
                />
              </View>
            </>
          )}

          {painFlag === "pain" && (
            <>
              <ThemedText style={styles.question}>
                <Trans>Where did you feel it?</Trans>
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    color: colors.contentPrimary,
                    borderColor: colors.accentBorder,
                  },
                ]}
                placeholder={t`Optional description`}
                placeholderTextColor={colors.contentSecondary}
                value={painNotes}
                onChangeText={setPainNotes}
                maxLength={120}
              />
            </>
          )}

          <View style={styles.submitRow}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!canSubmit}
              buttonColor={colors.accent}
              textColor={colors.onAccent ?? colors.background}
              style={styles.submitButton}
            >
              <Trans>Done</Trans>
            </Button>
          </View>
        </ScrollView>
      </BottomSheetView>
    </AppBottomSheet>
  );
});

export default ExerciseFeedbackSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 4,
  },
  question: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 16,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  submitRow: {
    marginTop: 24,
    alignItems: "flex-end",
  },
  submitButton: {
    borderRadius: 20,
    minWidth: 100,
  },
});
