import React from "react";
import { View, StyleSheet } from "react-native";
import { Button, Divider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import ProgressionSuggestionChip from "@/components/ProgressionSuggestionChip";
import { useAppTheme } from "@/theme";
import { useWorkoutProgressionStatesQuery } from "@/hooks/useWorkoutProgressionStatesQuery";
import { useApplyProgressionMutation } from "@/hooks/useApplyProgressionMutation";
import { WorkoutProgressionStateRow } from "@/utils/database";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

function getRuleExplanation(ruleKey: string): string {
  const map: Record<string, string> = {
    PAIN_BLOCK: t`Pain reported. Keeping load unchanged until you feel better.`,
    FAILED_SETS: t`You couldn't complete all sets. Reducing load slightly for next time.`,
    POOR_RECOVERY: t`Still recovering. Hold this load for now.`,
    BELOW_TARGET: t`Rep target not met. Hold steady for now.`,
    EASY_TARGET_LOAD: t`You've been hitting targets easily. Time to add a little more weight.`,
    EASY_TARGET_REPS: t`Good pace. Try adding one rep per set before bumping the load.`,
    EASY_FIRST_SIGNAL: t`Felt easy this time. Hold for now and confirm next session.`,
    EASY_HOLD_REQUESTED: t`You chose to keep it steady. Hold this load.`,
    MODERATE_TARGET: t`Solid session. Keep this load.`,
    HARD_TARGET: t`You finished everything at the limit. Stay here and own it.`,
    UNSUPPORTED_TRACKING: t`No progression tracking for this exercise type.`,
    NO_PRIOR_WEIGHT: t`No prior weight data. Hold steady for now.`,
    DEFAULT: t`Hold steady this session.`,
  };
  return map[ruleKey] ?? t`Hold steady this session.`;
}

interface ProgressionSummaryCardProps {
  workoutId: number;
  weightUnit: string;
}

export default function ProgressionSummaryCard({
  workoutId,
  weightUnit,
}: ProgressionSummaryCardProps) {
  const { colors } = useAppTheme();
  const { data: states } = useWorkoutProgressionStatesQuery(workoutId);
  const { applyMutation, dismissMutation } = useApplyProgressionMutation();

  const actionable = (states ?? []).filter(
    (s) => s.suggestionAction !== "hold" && !s.isApplied,
  );

  if (actionable.length === 0) return null;

  const handleAcceptAll = async () => {
    for (const s of actionable) {
      await applyMutation.mutateAsync({
        userWorkoutExerciseId: s.userWorkoutExerciseId,
        suggestedRepsMin: s.suggestedRepsMin,
        suggestedRepsMax: s.suggestedRepsMax,
      });
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>
          <Trans>Next Session</Trans>
        </ThemedText>
        {actionable.length > 1 && (
          <Button
            mode="text"
            compact
            onPress={handleAcceptAll}
            textColor={colors.accent}
            style={styles.acceptAllButton}
          >
            <Trans>Accept all</Trans>
          </Button>
        )}
      </View>

      {actionable.map((state, index) => (
        <React.Fragment key={state.userWorkoutExerciseId}>
          {index > 0 && <Divider style={styles.divider} />}
          <SuggestionRow
            state={state}
            weightUnit={weightUnit}
            onAccept={() =>
              applyMutation.mutate({
                userWorkoutExerciseId: state.userWorkoutExerciseId,
                suggestedRepsMin: state.suggestedRepsMin,
                suggestedRepsMax: state.suggestedRepsMax,
              })
            }
            onDismiss={() =>
              dismissMutation.mutate({
                userWorkoutExerciseId: state.userWorkoutExerciseId,
              })
            }
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function SuggestionRow({
  state,
  weightUnit,
  onAccept,
  onDismiss,
}: {
  state: WorkoutProgressionStateRow;
  weightUnit: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <ThemedText style={styles.exerciseName} numberOfLines={1}>
          {state.exerciseName}
        </ThemedText>
        <ProgressionSuggestionChip
          action={state.suggestionAction}
          suggestedWeight={state.suggestedWeight}
          suggestedRepsMin={state.suggestedRepsMin}
          suggestedRepsMax={state.suggestedRepsMax}
          weightUnit={weightUnit}
        />
        <ThemedText
          style={[styles.explanation, { color: colors.contentSecondary }]}
        >
          {getRuleExplanation(state.ruleKey)}
        </ThemedText>
      </View>
      <View style={styles.rowActions}>
        <Button
          mode="contained"
          compact
          onPress={onAccept}
          buttonColor={colors.accent}
          textColor={colors.onAccent}
          style={styles.actionButton}
        >
          <Trans>Accept</Trans>
        </Button>
        <Button
          mode="text"
          compact
          onPress={onDismiss}
          textColor={colors.contentSecondary}
        >
          <Trans>Dismiss</Trans>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  acceptAllButton: {
    marginRight: -8,
  },
  divider: {
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    gap: 6,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600",
  },
  explanation: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: 2,
  },
  actionButton: {
    borderRadius: 14,
  },
});
