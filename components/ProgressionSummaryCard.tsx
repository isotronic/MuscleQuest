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
import { router } from "expo-router";

function getRuleExplanation(ruleKey: string): string {
  const map: Record<string, string> = {
    PAIN_BLOCK: t`Pain reported. Keeping load unchanged until you feel better.`,
    PAIN_LOAD: t`Pain reported again. Consider reducing load to help your recovery.`,
    DISCOMFORT_SIGNAL: t`Some discomfort noted. Keeping load steady to monitor.`,
    DISCOMFORT_RECURRING: t`Recurring discomfort. Consider adjusting form or consulting a coach.`,
    FAILED_FIRST_SIGNAL: t`Tough session. Holding steady for now. If it happens again, the load will be reduced.`,
    FAILED_SETS: t`You couldn't complete all sets. Reducing load slightly for next time.`,
    POOR_RECOVERY: t`Still recovering. Hold this load for now.`,
    BELOW_TARGET: t`Significantly short of the target. Hold and focus on hitting all reps before progressing.`,
    NEAR_TARGET: t`Almost there. Just missed the rep target. Hold and try again next session.`,
    EASY_TARGET_LOAD: t`You've been hitting targets easily. Time to add a little more weight.`,
    EASY_TARGET_REPS: t`Good pace. Try adding one rep per set before bumping the load.`,
    EASY_HOLD_REQUESTED: t`You chose to keep it steady. Hold this load.`,
    MODERATE_TARGET: t`Solid session. Keep this load.`,
    HARD_TARGET: t`You finished everything at the limit. Stay here and own it.`,
    UNSUPPORTED_TRACKING: t`No progression tracking for this exercise type.`,
    NO_PRIOR_WEIGHT: t`No prior weight data. Hold steady for now.`,
    DEFAULT: t`Hold steady this session.`,
  };
  return map[ruleKey] ?? t`Hold steady this session.`;
}

function formatLastProgression(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return t`Last increased: today`;
  if (days === 1) return t`Last increased: yesterday`;
  if (days < 7) return t`Last increased: ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return t`Last increased: 1 week ago`;
  if (weeks < 5) return t`Last increased: ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return t`Last increased: 1 month ago`;
  return t`Last increased: ${months} months ago`;
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

  const showDeloadBanner =
    (states ?? []).filter(
      (s) =>
        s.suggestionAction === "reduce_load" || s.recoveryRating === "sore",
    ).length >= 3;

  if (actionable.length === 0 && !showDeloadBanner) return null;

  const handleAcceptAll = async () => {
    for (const s of actionable) {
      await applyMutation.mutateAsync({
        userWorkoutExerciseId: s.userWorkoutExerciseId,
      });
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {actionable.length > 0 && (
        <>
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
        </>
      )}

      {showDeloadBanner && (
        <>
          {actionable.length > 0 && <Divider style={styles.divider} />}
          <View style={styles.deloadBanner}>
            <ThemedText
              style={[styles.deloadText, { color: colors.contentPrimary }]}
            >
              <Trans>
                Multiple exercises showing fatigue signs. A deload week may help
                you recover and come back stronger.
              </Trans>
            </ThemedText>
            <Button
              mode="text"
              compact
              textColor={colors.accent}
              onPress={() =>
                router.push("/(app)/(tabs)/(plans)/overview" as any)
              }
              style={styles.deloadButton}
            >
              <Trans>View Deload Option</Trans>
            </Button>
          </View>
        </>
      )}
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
          suggestedRepsPerSet={state.suggestedRepsPerSet}
          weightUnit={weightUnit}
        />
        <ThemedText
          style={[styles.explanation, { color: colors.contentSecondary }]}
        >
          {getRuleExplanation(state.ruleKey)}
        </ThemedText>
        {state.plateauAdvisory && (
          <ThemedText
            style={[styles.plateauNote, { color: colors.contentSecondary }]}
          >
            <Trans>
              This exercise has held steady for 4 sessions. A technique check or
              a brief deload may help break the plateau.
            </Trans>
          </ThemedText>
        )}
        {state.lastProgressionAt && (
          <ThemedText
            style={[styles.lastProgression, { color: colors.contentSecondary }]}
          >
            {formatLastProgression(state.lastProgressionAt)}
          </ThemedText>
        )}
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
  plateauNote: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
  },
  lastProgression: {
    fontSize: 11,
    lineHeight: 14,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: 2,
  },
  actionButton: {
    borderRadius: 14,
  },
  deloadBanner: {
    paddingTop: 4,
    gap: 4,
  },
  deloadText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deloadButton: {
    alignSelf: "flex-start",
    marginLeft: -8,
  },
});
