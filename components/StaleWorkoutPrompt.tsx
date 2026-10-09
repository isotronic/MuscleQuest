import { useMemo } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Modal, Portal } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStaleWorkoutPromptStore } from "@/store/staleWorkoutPromptStore";
import { cancelRestNotifications } from "@/utils/restNotification";
import { formatTimeAgo } from "@/utils/relativeTime";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { displayWorkoutName } from "@/utils/workoutName";

/**
 * Asks what to do with a workout that was left for hours, instead of resuming
 * it as if no time had passed. Shown by resumeActiveWorkout().
 */
export function StaleWorkoutPrompt() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visible = useStaleWorkoutPromptStore((s) => s.visible);
  const hide = useStaleWorkoutPromptStore((s) => s.hide);
  const name = useActiveWorkoutStore((s) => s.activeWorkout?.name);
  const startTime = useActiveWorkoutStore((s) => s.startTime);
  const lastActivityAt = useActiveWorkoutStore((s) => s.lastActivityAt);
  const hasCompletedSets = useActiveWorkoutStore((s) =>
    Object.values(s.completedSets).some((sets) =>
      Object.values(sets).some((done) => done === true),
    ),
  );

  if (!visible) return null;

  const workoutName = name ? displayWorkoutName(name) : t`your workout`;
  const startedAgo = startTime ? formatTimeAgo(new Date(startTime)) : "";
  const lastSetAgo = lastActivityAt
    ? formatTimeAgo(new Date(lastActivityAt))
    : null;

  const resume = () => {
    hide();
    router.push("/(app)/(workout)");
  };

  // The workout screen owns saving; it caps the duration of a stale workout.
  const finishAndSave = () => {
    hide();
    router.push({ pathname: "/(app)/(workout)", params: { finish: "true" } });
  };

  const discard = () => {
    Alert.alert(
      t`Cancel Workout`,
      t`Are you sure you want to cancel and delete this workout?`,
      [
        { text: t`No`, style: "cancel" },
        {
          text: t`Yes`,
          style: "destructive",
          onPress: () => {
            void cancelRestNotifications();
            useActiveWorkoutStore.getState().clearPersistedStore();
            hide();
          },
        },
      ],
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={hide}
        contentContainerStyle={styles.modal}
        theme={{ colors: { backdrop: colors.modalBackdrop } }}
      >
        <ThemedText
          accessibilityRole="header"
          type="subtitle"
          style={styles.title}
        >
          <Trans>Pick up where you left off?</Trans>
        </ThemedText>
        <ThemedText testID="stale-workout-body" style={styles.body}>
          {lastSetAgo ? (
            <Trans>
              You started {workoutName} {startedAgo}. Your last set was{" "}
              {lastSetAgo}.
            </Trans>
          ) : (
            <Trans>
              You started {workoutName} {startedAgo}.
            </Trans>
          )}
        </ThemedText>
        <View style={styles.buttons}>
          <Button
            mode="contained"
            theme={{ colors: { primary: colors.accent } }}
            onPress={resume}
            testID="stale-resume"
          >
            <Trans>Resume</Trans>
          </Button>
          {hasCompletedSets && (
            <Button
              mode="outlined"
              onPress={finishAndSave}
              testID="stale-finish"
            >
              <Trans>Finish and save</Trans>
            </Button>
          )}
          <Button
            mode="text"
            textColor={colors.danger}
            onPress={discard}
            testID="stale-discard"
          >
            <Trans>Discard</Trans>
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modal: {
      backgroundColor: colors.card,
      margin: 24,
      borderRadius: radii.lg,
      padding: 24,
    },
    title: {
      marginBottom: 8,
    },
    body: {
      color: colors.contentSecondary,
      marginBottom: 20,
    },
    buttons: {
      gap: 8,
    },
  });
}
