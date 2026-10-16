import { useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ProgressBar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppImage } from "@/components/ui";
import { SeedingFailedNotice } from "@/components/SeedingFailedNotice";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { useWhenSeeded } from "@/hooks/useWhenSeeded";
import { updateSettings } from "@/utils/database";
import { readLastBackupDate, restoreDatabaseBackup } from "@/utils/backup";
import { getBackupErrorMessage } from "@/utils/backupErrorMessage";
import { restoreConfirmMessage } from "@/utils/restoreConfirmMessage";
import { whenFilesSettled } from "@/utils/firstLaunchSeeding";
import { withTimeout } from "@/utils/withTimeout";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { showSnackbar } from "@/store/snackbarStore";

const logo = require("@/assets/images/icon.png");

const BACKUP_CHECK_TIMEOUT_MS = 10000;

/**
 * "setup": the step after setup. "returning": from Welcome, before setup.
 * Absent: the (app) layout's fallback for an install that never saw it.
 */
type OnboardingMode = "setup" | "returning" | undefined;

/** The account's last backup date; null for none; undefined when unknown. */
const findBackup = async (): Promise<Date | null | undefined> => {
  try {
    return await withTimeout(
      readLastBackupDate(),
      BACKUP_CHECK_TIMEOUT_MS,
      "Last backup lookup",
    );
  } catch (error) {
    notifyBugsnag(error);
    return undefined;
  }
};

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const mode: OnboardingMode =
    onboarding === "setup" || onboarding === "returning"
      ? onboarding
      : undefined;
  const { signIn, isSigningIn, isOnline } = useGoogleSignIn();
  const seeding = useWhenSeeded();
  const [checkingBackup, setCheckingBackup] = useState(false);
  const [backupDate, setBackupDate] = useState<Date | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);

  // From Welcome, which replaced itself with this screen: Back returns there.
  useEffect(() => {
    if (mode !== "returning") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.replace("/welcome");
        return true;
      },
    );
    return () => subscription.remove();
  }, [mode]);

  // Leaves the screen; the write waits for the background seeding.
  const finish = (noBackupFound = false) =>
    seeding.run(async () => {
      try {
        await updateSettings("loginShown", "true");
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
        // Nothing on screen watches settings, so the invalidate alone would
        // leave the (app) gate a cached loginShown of undefined.
        await queryClient.refetchQueries({ queryKey: ["settings"] });
      } catch (error) {
        notifyBugsnag(error);
      }
      if (mode === "setup") {
        router.replace("/get-started");
      } else if (mode === "returning") {
        if (noBackupFound) showSnackbar(t`No backup found for this account.`);
        router.replace("/setup");
      } else {
        router.replace("/");
      }
    });

  async function handleSignIn() {
    const result = await signIn();
    if (result?.status !== "success") return;
    if (!mode) {
      await finish();
      return;
    }
    setCheckingBackup(true);
    const found = await findBackup();
    setCheckingBackup(false);
    if (found) {
      setBackupDate(found);
      return;
    }
    await finish(found === null);
  }

  async function handleRestore() {
    setIsRestoring(true);
    try {
      // The restore swaps the database files; nothing may have them open.
      await whenFilesSettled();
      // Reloads the app into the restored data on success.
      await restoreDatabaseBackup(
        setRestoreProgress,
        setIsRestoring,
        queryClient,
      );
    } catch (error) {
      setIsRestoring(false);
      Alert.alert(t`Restore failed`, getBackupErrorMessage(error, "restore"));
    }
  }

  const busy = isSigningIn || checkingBackup || isRestoring || seeding.waiting;

  if (backupDate) {
    const date = backupDate.toLocaleDateString();
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="title" style={styles.title}>
            <Trans>Welcome back</Trans>
          </ThemedText>
          <ThemedText style={styles.text}>
            <Trans>Restore your backup from {date}?</Trans>
          </ThemedText>
          <ThemedText style={styles.hint}>
            {restoreConfirmMessage(date, false)}
          </ThemedText>
          {isRestoring && (
            <ProgressBar
              progress={restoreProgress / 100}
              color={colors.accent}
              style={styles.progress}
            />
          )}
          {seeding.failed && <SeedingFailedNotice onRetry={seeding.retry} />}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            mode="contained"
            onPress={handleRestore}
            loading={isRestoring}
            disabled={busy}
            testID="login-restore"
          >
            <Trans>Restore</Trans>
          </Button>
          <Button
            mode="text"
            onPress={() => finish()}
            disabled={busy}
            testID="login-start-fresh"
          >
            <Trans>Start fresh</Trans>
          </Button>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppImage source={logo} style={styles.logo} />
        <ThemedText type="title" style={styles.title}>
          {mode === "returning" ? (
            <Trans>Sign in to find your backup</Trans>
          ) : (
            <Trans>Sign in to keep your training safe</Trans>
          )}
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Back up your training and restore it on any phone</Trans>
        </ThemedText>
        <ThemedText style={styles.benefit}>
          <Trans>• Add friends and share plans and workouts</Trans>
        </ThemedText>
        <ThemedText style={styles.hint}>
          {isOnline ? (
            <Trans>You can sign in later from Settings.</Trans>
          ) : (
            <Trans>
              Sign-in needs an internet connection. You can sign in later from
              Settings.
            </Trans>
          )}
        </ThemedText>
        {seeding.failed && <SeedingFailedNotice onRetry={seeding.retry} />}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {isOnline && (
          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={isSigningIn || checkingBackup}
            disabled={busy}
            accessibilityLabel={t`Sign in with Google`}
            testID="login-google"
          >
            <Trans>Sign in with Google</Trans>
          </Button>
        )}
        <Button
          mode={isOnline ? "text" : "contained"}
          onPress={() => finish()}
          loading={seeding.waiting}
          disabled={busy}
          testID="login-skip"
        >
          {seeding.waiting ? (
            <Trans>Almost ready…</Trans>
          ) : (
            <Trans>Not now</Trans>
          )}
        </Button>
      </View>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    scroll: { flexGrow: 1, justifyContent: "center", paddingBottom: 24 },
    logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 24 },
    title: { marginBottom: 16, color: colors.contentPrimary },
    text: { marginBottom: 8, color: colors.contentPrimary },
    benefit: { marginBottom: 6, color: colors.contentPrimary },
    hint: { marginTop: 8, color: colors.contentSecondary },
    progress: { marginTop: 16 },
    footer: { gap: 8, paddingTop: 12 },
  });
}
