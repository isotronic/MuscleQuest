import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { useSavedWorkoutSessionCountQuery } from "@/hooks/useSavedWorkoutSessionCountQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { toLocalDateKey } from "@/utils/dates";
import {
  PROGRESSION_OFFER_SETTING,
  notNowAnswer,
  shouldOfferProgression,
} from "@/utils/progressionOffer";

/**
 * Offers adaptive progression on the workout summary to someone who keeps
 * training saved workouts with it off.
 */
export default function ProgressionOfferCard({
  fromSavedWorkout,
}: {
  /** The session came from a plan or a saved workout, not a quick workout. */
  fromSavedWorkout: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: settings } = useSettingsQuery();
  const { enabled } = useProgressionSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const { data: savedSessionCount } = useSavedWorkoutSessionCountQuery(
    !!settings && !enabled && fromSavedWorkout,
  );
  // Kept after answering: turning it on hides the offer but shows the note.
  const [answered, setAnswered] = useState<"on" | "later" | null>(null);

  const answer = settings?.[PROGRESSION_OFFER_SETTING];
  const today = toLocalDateKey(new Date());

  if (answered === "on") {
    return (
      <View style={styles.card}>
        <ThemedText style={styles.body}>
          <Trans>
            Suggestions are on. You will get a quick question after each
            exercise.
          </Trans>
        </ThemedText>
        <Button
          mode="text"
          compact
          style={styles.settingsLink}
          onPress={() =>
            router.push({
              pathname: "/(app)/settings",
              params: { section: "progression" },
            })
          }
        >
          <Trans>Open settings</Trans>
        </Button>
      </View>
    );
  }

  if (
    answered === "later" ||
    !settings ||
    savedSessionCount == null ||
    !shouldOfferProgression({
      enabled,
      fromSavedWorkout,
      savedSessionCount,
      answer,
      today,
    })
  ) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon set="mci" name="trending-up" size={20} color={colors.accent} />
        <ThemedText accessibilityRole="header" style={styles.title}>
          <Trans>Want MuscleQuest to suggest your next weights?</Trans>
        </ThemedText>
      </View>
      <ThemedText style={styles.body}>
        <Trans>
          After each exercise you answer one quick question. Once two sessions
          go well, MuscleQuest suggests adding weight or reps. Nothing changes
          until you accept.
        </Trans>
      </ThemedText>
      <View style={styles.actions}>
        <Button
          mode="text"
          compact
          style={styles.howItWorks}
          onPress={() =>
            router.push({
              pathname: "/(app)/help",
              params: { group: "adaptive-progression" },
            })
          }
        >
          <Trans>How it works</Trans>
        </Button>
        <Button
          mode="text"
          onPress={() => {
            setAnswered("later");
            updateSetting({
              key: PROGRESSION_OFFER_SETTING,
              value: notNowAnswer(answer, today),
            });
          }}
        >
          <Trans>Not now</Trans>
        </Button>
        <Button
          mode="contained"
          onPress={() => {
            setAnswered("on");
            updateSetting({ key: PROGRESSION_OFFER_SETTING, value: "on" });
            updateSetting({ key: "adaptive_progression_enabled", value: "1" });
          }}
        >
          <Trans>Turn on</Trans>
        </Button>
      </View>
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
      gap: 8,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    body: {
      fontSize: 14,
      color: colors.contentPrimary,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
    settingsLink: {
      alignSelf: "flex-start",
    },
    // Left, away from the answers.
    howItWorks: {
      marginRight: "auto",
    },
  });
}
