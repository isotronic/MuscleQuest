import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import ExerciseFeedbackCard from "@/components/ExerciseFeedbackCard";
import { useSubmitFeedbackPrompt } from "@/hooks/useSubmitFeedbackPrompt";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";
import { showSnackbar } from "@/store/snackbarStore";

/**
 * Feedback cards skipped or left unanswered during the session, offered once
 * more on the summary. Rows not answered are dropped when the summary closes,
 * so no feedback is stored for them.
 */
export default function FeedbackCatchUpCard({
  prompts,
}: {
  prompts: FeedbackPrompt[];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const submitFeedbackPrompt = useSubmitFeedbackPrompt();
  const [answered, setAnswered] = useState<number[]>([]);
  // Bumped when a write fails, to remount that row so it can be answered again.
  const [attempts, setAttempts] = useState<Record<number, number>>({});

  const remaining = prompts.filter(
    (p) => !answered.includes(p.userWorkoutExerciseId),
  );
  if (remaining.length === 0) return null;

  return (
    <View style={styles.card}>
      <ThemedText accessibilityRole="header" style={styles.title}>
        <Trans>Help tune your next session</Trans>
      </ThemedText>
      {remaining.map((prompt) => (
        <ExerciseFeedbackCard
          key={`${prompt.userWorkoutExerciseId}-${attempts[prompt.userWorkoutExerciseId] ?? 0}`}
          prompt={prompt}
          onSubmit={(payload) => {
            const id = prompt.userWorkoutExerciseId;
            void submitFeedbackPrompt(prompt, payload).then((saved) => {
              if (!saved) {
                // The row stays so the answer can be sent again.
                setAttempts((a) => ({ ...a, [id]: (a[id] ?? 0) + 1 }));
                showSnackbar(t`Your answer was not saved. Try again.`);
                return;
              }
              setAnswered((ids) => [...ids, id]);
              // Refreshes the Next session card above with the new suggestion.
              void queryClient.invalidateQueries({
                queryKey: ["workoutProgressionStates"],
              });
            });
          }}
        />
      ))}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.contentPrimary,
    },
  });
}
