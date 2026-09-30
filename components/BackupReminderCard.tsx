import { useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, ProgressBar } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { Plural, Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { AppIcon } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { useBackupReminder } from "@/hooks/useBackupReminder";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { uploadDatabaseBackup } from "@/utils/backup";
import { getBackupErrorMessage } from "@/utils/backupErrorMessage";
import { showSnackbar } from "@/store/snackbarStore";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * Home-screen nudge to back up, or to sign in so a backup is possible.
 * Renders nothing unless useBackupReminder has something to say.
 */
export function BackupReminderCard() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { reminder, dismiss, dismissForever } = useBackupReminder();
  const { signIn, isSigningIn, isOnline } = useGoogleSignIn();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const isBackingUpRef = useRef(false);

  if (!reminder) return null;

  // Uploads in place; a successful backup clears the reminder by itself once
  // the backup date refetches.
  const backUpNow = async () => {
    if (isBackingUpRef.current) return;
    isBackingUpRef.current = true;
    try {
      await uploadDatabaseBackup(setProgress, setIsBackingUp);
      queryClient.invalidateQueries({ queryKey: ["lastBackupDate"] });
      showSnackbar(t`Backup complete.`);
    } catch (error) {
      Alert.alert(t`Backup Failed`, getBackupErrorMessage(error, "backup"));
    } finally {
      isBackingUpRef.current = false;
    }
  };

  const busy = isBackingUp || isSigningIn;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon
          set="mci"
          name="cloud-upload-outline"
          size={24}
          color={colors.accent}
        />
        <ThemedText style={styles.message}>
          {reminder.reason === "neverBackedUp" && (
            <Trans>
              Back up your training history. If you lose or replace your phone,
              a backup is the only way to get it back.
            </Trans>
          )}
          {reminder.reason === "stale" && (
            <Trans>
              Your last backup was{" "}
              <Plural
                value={reminder.daysSinceBackup}
                one="# day"
                other="# days"
              />{" "}
              ago. You've logged{" "}
              <Plural
                value={reminder.workoutsSinceBackup}
                one="# workout"
                other="# workouts"
              />{" "}
              since.
            </Trans>
          )}
          {reminder.reason === "signedOutNoBackup" && (
            <Trans>
              Your workouts are only stored on this phone. Sign in to back them
              up.
            </Trans>
          )}
        </ThemedText>
      </View>
      {isBackingUp && (
        <ProgressBar
          animatedValue={progress / 100}
          color={colors.accent}
          style={styles.progress}
        />
      )}
      {!isOnline && (
        <ThemedText style={styles.helper}>
          {reminder.reason === "signedOutNoBackup" ? (
            <Trans>Sign-in needs an internet connection.</Trans>
          ) : (
            <Trans>Backup needs an internet connection.</Trans>
          )}
        </ThemedText>
      )}
      <View style={styles.buttons}>
        {reminder.reason === "signedOutNoBackup" && (
          <Button
            mode="text"
            compact
            disabled={busy}
            onPress={dismissForever}
            testID="backup-reminder-never"
          >
            <Trans>Don't remind me</Trans>
          </Button>
        )}
        <Button
          mode="text"
          compact
          disabled={busy}
          onPress={dismiss}
          testID="backup-reminder-later"
        >
          <Trans>Later</Trans>
        </Button>
        {reminder.reason === "signedOutNoBackup" ? (
          <Button
            mode="contained"
            compact
            theme={{ colors: { primary: colors.accent } }}
            loading={isSigningIn}
            disabled={busy || !isOnline}
            onPress={() => void signIn()}
            testID="backup-reminder-sign-in"
          >
            <Trans>Sign in</Trans>
          </Button>
        ) : (
          <Button
            mode="contained"
            compact
            theme={{ colors: { primary: colors.accent } }}
            loading={isBackingUp}
            disabled={busy || !isOnline}
            onPress={() => void backUpNow()}
            testID="backup-reminder-backup"
          >
            <Trans>Back up now</Trans>
          </Button>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.md,
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    message: {
      flex: 1,
      color: colors.contentPrimary,
      fontSize: 14,
    },
    progress: {
      marginTop: 12,
    },
    helper: {
      marginTop: 8,
      color: colors.contentSecondary,
      fontSize: 13,
    },
    buttons: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 4,
      marginTop: 12,
    },
  });
}
