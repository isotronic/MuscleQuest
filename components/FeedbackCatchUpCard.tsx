import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import ExerciseFeedbackCard from "@/components/ExerciseFeedbackCard";
import { useSubmitFeedbackPrompt } from "@/hooks/useSubmitFeedbackPrompt";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type { FeedbackPrompt } from "@/utils/feedbackPrompts";

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
          key={prompt.userWorkoutExerciseId}
          prompt={prompt}
          onSubmit={(payload) => {
            setAnswered((ids) => [...ids, prompt.userWorkoutExerciseId]);
            submitFeedbackPrompt(prompt, payload, () =>
              // Refreshes the Next session card above with the new suggestion.
              queryClient.invalidateQueries({
                queryKey: ["workoutProgressionStates"],
              }),
            );
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
