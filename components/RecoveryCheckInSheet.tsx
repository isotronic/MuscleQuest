import React, { useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
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
import { RecoveryCheckInPayload, RecoveryRating } from "@/types/progression";

interface PendingCheckIn {
  userWorkoutExerciseId: number;
  exerciseId: number;
  targetMuscle: string;
}

interface RecoveryCheckInSheetProps {
  pendingCheckIns: PendingCheckIn[];
  onSubmit: (payloads: RecoveryCheckInPayload[]) => void;
}

const RECOVERY_OPTIONS: { value: RecoveryRating; label: string }[] = [
  { value: "fresh", label: "Fresh, fully recovered" },
  { value: "mild", label: "Mild soreness" },
  { value: "sore", label: "Still very sore" },
];

function MuscleQuestion({
  muscle,
  value,
  onChange,
  colors,
}: {
  muscle: string;
  value: RecoveryRating | null;
  onChange: (v: RecoveryRating) => void;
  colors: AppThemeColors;
}) {
  return (
    <View style={styles.questionBlock}>
      <ThemedText style={styles.muscleName}>{muscle}</ThemedText>
      <View style={styles.optionsRow}>
        {RECOVERY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === opt.value }}
            style={[
              styles.optionChip,
              {
                backgroundColor:
                  value === opt.value ? colors.accent : colors.surfaceHighlight,
                borderColor:
                  value === opt.value ? colors.accent : colors.accentBorder,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.optionLabel,
                {
                  color:
                    value === opt.value
                      ? colors.onAccent
                      : colors.contentPrimary,
                },
              ]}
            >
              {opt.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const RecoveryCheckInSheet = React.forwardRef<
  BottomSheetModal,
  RecoveryCheckInSheetProps
>(function RecoveryCheckInSheet({ pendingCheckIns, onSubmit }, ref) {
  const { colors } = useAppTheme();

  const muscleGroups = Array.from(
    new Map(pendingCheckIns.map((c) => [c.targetMuscle, c])).values(),
  );

  const [ratings, setRatings] = useState<Record<string, RecoveryRating>>({});

  const allAnswered =
    muscleGroups.length > 0 &&
    muscleGroups.every((g) => ratings[g.targetMuscle] != null);

  const handleDismiss = useCallback(() => {
    setRatings({});
  }, []);

  const handleSubmit = useCallback(() => {
    if (!allAnswered) return;
    const payloads: RecoveryCheckInPayload[] = pendingCheckIns.map((c) => ({
      userWorkoutExerciseId: c.userWorkoutExerciseId,
      exerciseId: c.exerciseId,
      recoveryRating: ratings[c.targetMuscle]!,
    }));
    setRatings({});
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    onSubmit(payloads);
  }, [allAnswered, pendingCheckIns, ratings, ref, onSubmit]);

  const handleSkip = useCallback(() => {
    setRatings({});
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  }, [ref]);

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
      snapPoints={["55%", "90%"]}
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
          <ThemedText style={styles.title}>Recovery Check-in</ThemedText>
          <ThemedText style={styles.subtitle}>
            How are these muscles feeling since your last session?
          </ThemedText>

          {muscleGroups.map((group) => (
            <MuscleQuestion
              key={group.targetMuscle}
              muscle={group.targetMuscle}
              value={ratings[group.targetMuscle] ?? null}
              onChange={(v) =>
                setRatings((prev) => ({
                  ...prev,
                  [group.targetMuscle]: v,
                }))
              }
              colors={colors}
            />
          ))}

          <View style={styles.buttonRow}>
            <Button
              mode="text"
              onPress={handleSkip}
              textColor={colors.contentSecondary}
            >
              Skip for now
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!allAnswered}
              buttonColor={colors.accent}
              textColor={colors.onAccent}
              style={styles.submitButton}
            >
              Done
            </Button>
          </View>
        </ScrollView>
      </BottomSheetView>
    </AppBottomSheet>
  );
});

export default RecoveryCheckInSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    opacity: 0.7,
  },
  questionBlock: {
    marginBottom: 20,
  },
  muscleName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "capitalize",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  submitButton: {
    borderRadius: 20,
  },
});
