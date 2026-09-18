import { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { MessageDescriptor } from "@lingui/core";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppButton, AppIcon } from "@/components/ui";
import { AuthContext } from "@/context/AuthProvider";
import { useTrainingDataExport } from "@/hooks/useTrainingDataExport";
import {
  AccountDeletionError,
  DELETION_STEPS,
  DeletionStep,
  deleteAccount,
} from "@/utils/accountDeletion";
import { clearDatabaseAndReinitialize } from "@/utils/clearUserData";
import { radii, useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

// Typed to enable the final button. Kept in English in every language so the
// instruction and the check always agree.
const CONFIRMATION_WORD = "DELETE";

const STEP_LABELS: Record<DeletionStep, MessageDescriptor> = {
  reauth: msg`Confirming it's you`,
  friends: msg`Removing friend connections`,
  requests: msg`Removing friend requests`,
  shared: msg`Deleting everything shared with friends`,
  profile: msg`Deleting your profile`,
  backups: msg`Deleting cloud backups`,
  auth: msg`Deleting your sign-in account`,
};

type Phase = "confirm" | "deleting" | "failed" | "localChoice" | "done";

export default function DeleteAccountScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { _ } = useLingui();
  const user = useContext(AuthContext);
  // The auth user disappears partway through, so hold on to the uid.
  const [uid] = useState(() => user?.uid ?? null);

  const { isExporting, promptExport } = useTrainingDataExport();

  const [phase, setPhase] = useState<Phase>("confirm");
  const [confirmation, setConfirmation] = useState("");
  const [currentStep, setCurrentStep] = useState<DeletionStep | null>(null);

  const isDeleting = phase === "deleting";
  usePreventRemove(isDeleting, () => {});

  const runDeletion = async () => {
    if (!uid) return;
    setPhase("deleting");
    try {
      await deleteAccount(uid, setCurrentStep);
      setCurrentStep(null);
      setPhase("localChoice");
    } catch (error) {
      if (error instanceof AccountDeletionError && error.cancelled) {
        setCurrentStep(null);
        setPhase("confirm");
        return;
      }
      setPhase("failed");
    }
  };

  const confirmDeleteLocalData = () => {
    Alert.alert(
      t`Delete training history?`,
      t`This removes all workouts, plans and measurements from this device. It cannot be undone. The app will restart.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => {
            clearDatabaseAndReinitialize();
          },
        },
      ],
    );
  };

  const stepState = (step: DeletionStep) => {
    const index = DELETION_STEPS.indexOf(step);
    const currentIndex = currentStep ? DELETION_STEPS.indexOf(currentStep) : -1;
    if (phase === "localChoice" || phase === "done") return "done";
    if (currentIndex === -1 || index > currentIndex) return "pending";
    if (index < currentIndex) return "done";
    return phase === "failed" ? "failed" : "running";
  };

  const renderStepIcon = (step: DeletionStep) => {
    switch (stepState(step)) {
      case "done":
        return (
          <AppIcon
            set="mci"
            name="check-circle"
            size={22}
            color={colors.success}
          />
        );
      case "running":
        return <ActivityIndicator size="small" color={colors.accent} />;
      case "failed":
        return (
          <AppIcon
            set="mci"
            name="alert-circle"
            size={22}
            color={colors.danger}
          />
        );
      default:
        return (
          <AppIcon
            set="mci"
            name="circle-outline"
            size={22}
            color={colors.contentDisabled}
          />
        );
    }
  };

  const renderProgress = () => (
    <View style={styles.card}>
      {DELETION_STEPS.map((step) => (
        <View key={step} style={styles.stepRow}>
          <View style={styles.stepIcon}>{renderStepIcon(step)}</View>
          <ThemedText
            style={[
              styles.stepText,
              stepState(step) === "pending" && styles.stepTextPending,
            ]}
          >
            {_(STEP_LABELS[step])}
          </ThemedText>
        </View>
      ))}
    </View>
  );

  const renderBullet = (text: string) => (
    <View style={styles.bulletRow}>
      <ThemedText style={styles.bullet}>•</ThemedText>
      <ThemedText style={styles.body}>{text}</ThemedText>
    </View>
  );

  const renderConfirm = () => {
    const confirmed = confirmation.trim().toUpperCase() === CONFIRMATION_WORD;
    return (
      <>
        <ThemedText style={styles.body}>
          <Trans>
            This permanently deletes your MuscleQuest account. It cannot be
            undone.
          </Trans>
        </ThemedText>

        <ThemedText style={styles.heading}>
          <Trans>What will be deleted</Trans>
        </ThemedText>
        <View style={styles.card}>
          {renderBullet(t`Your profile and friend connections`)}
          {renderBullet(t`Pending friend requests`)}
          {renderBullet(t`Everything you shared with friends`)}
          {renderBullet(t`Your cloud backups`)}
          {renderBullet(t`Your sign-in account`)}
        </View>

        <ThemedText style={styles.heading}>
          <Trans>What will not be deleted</Trans>
        </ThemedText>
        <View style={styles.card}>
          {renderBullet(
            t`Training data on this device. You choose whether to keep it after the account is deleted.`,
          )}
          {renderBullet(t`Nothing is sent anywhere else.`)}
        </View>

        <ThemedText style={styles.heading}>
          <Trans>Keep a copy first</Trans>
        </ThemedText>
        <ThemedText style={styles.body}>
          <Trans>
            Cloud backups are deleted with your account. Export your training
            data if you want a copy.
          </Trans>
        </ThemedText>
        <AppButton
          variant="secondary"
          onPress={promptExport}
          loading={isExporting}
          disabled={isExporting}
          style={styles.button}
        >
          <Trans>Export training data</Trans>
        </AppButton>

        <ThemedText style={styles.heading}>
          <Trans>Confirm</Trans>
        </ThemedText>
        <ThemedText style={styles.body}>
          <Trans>
            Type {CONFIRMATION_WORD} to confirm. You will be asked to sign in
            with Google again.
          </Trans>
        </ThemedText>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRMATION_WORD}
          placeholderTextColor={colors.contentDisabled}
          style={styles.input}
          accessibilityLabel={t`Type ${CONFIRMATION_WORD} to confirm`}
        />
        <AppButton
          variant="danger"
          onPress={runDeletion}
          disabled={!confirmed || !uid}
          style={styles.button}
        >
          <Trans>Delete my account</Trans>
        </AppButton>
      </>
    );
  };

  const renderFailed = () => (
    <>
      {renderProgress()}
      <ThemedText style={[styles.body, styles.error]}>
        <Trans>
          Deletion stopped before it finished. Your account still exists and you
          are still signed in. Check your connection and try again.
        </Trans>
      </ThemedText>
      <AppButton variant="danger" onPress={runDeletion} style={styles.button}>
        <Trans>Retry</Trans>
      </AppButton>
      <AppButton
        variant="ghost"
        onPress={() => router.back()}
        style={styles.button}
      >
        <Trans>Cancel</Trans>
      </AppButton>
    </>
  );

  const renderLocalChoice = () => (
    <>
      {renderProgress()}
      <ThemedText style={styles.heading}>
        <Trans>Your account has been deleted</Trans>
      </ThemedText>
      <ThemedText style={styles.body}>
        <Trans>
          Keep training history on this device? If you keep it, you can go on
          using MuscleQuest without an account.
        </Trans>
      </ThemedText>
      <AppButton onPress={() => setPhase("done")} style={styles.button}>
        <Trans>Keep</Trans>
      </AppButton>
      <AppButton
        variant="danger"
        onPress={confirmDeleteLocalData}
        style={styles.button}
      >
        <Trans>Delete</Trans>
      </AppButton>
    </>
  );

  const renderDone = () => (
    <>
      <View style={styles.doneIcon}>
        <AppIcon
          set="mci"
          name="check-circle"
          size={56}
          color={colors.success}
        />
      </View>
      <ThemedText style={[styles.heading, styles.centered]}>
        <Trans>Your account has been deleted</Trans>
      </ThemedText>
      <ThemedText style={[styles.body, styles.centered]}>
        <Trans>
          Your training history stays on this device. You can keep using
          MuscleQuest without an account.
        </Trans>
      </ThemedText>
      <AppButton onPress={() => router.back()} style={styles.button}>
        <Trans>Done</Trans>
      </AppButton>
    </>
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerBackVisible: !isDeleting,
          gestureEnabled: !isDeleting,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {phase === "confirm" && renderConfirm()}
        {phase === "deleting" && renderProgress()}
        {phase === "failed" && renderFailed()}
        {phase === "localChoice" && renderLocalChoice()}
        {phase === "done" && renderDone()}
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      padding: 16,
      paddingBottom: 32,
    },
    heading: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.contentPrimary,
      marginTop: 24,
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      color: colors.contentSecondary,
      flexShrink: 1,
    },
    error: {
      color: colors.danger,
      marginTop: 16,
    },
    centered: {
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      gap: 8,
    },
    bulletRow: {
      flexDirection: "row",
      gap: 8,
    },
    bullet: {
      fontSize: 15,
      color: colors.contentSecondary,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },
    stepIcon: {
      width: 24,
      alignItems: "center",
    },
    stepText: {
      fontSize: 15,
      color: colors.contentPrimary,
      flexShrink: 1,
    },
    stepTextPending: {
      color: colors.contentDisabled,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.dangerMuted,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 12,
      fontSize: 16,
      color: colors.contentPrimary,
    },
    button: {
      marginTop: 16,
    },
    doneIcon: {
      alignItems: "center",
      marginTop: 32,
    },
  });
}
