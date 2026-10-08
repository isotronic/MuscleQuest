import React from "react";
import { Alert, StyleSheet, View } from "react-native";
import * as Updates from "expo-updates";
import Bugsnag from "@bugsnag/expo";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AppButton } from "@/components/ui";
import { clearDatabaseAndReinitialize } from "@/utils/clearUserData";
import {
  DATABASE_RESTORED_KEY,
  resetStartupFailureCount,
  undoLastRestoreAndReload,
} from "@/utils/startup";
import { hasRestoreToUndo } from "@/utils/restoreRollback";
import { removeAsyncStorageItem } from "@/utils/asyncStorage";

interface Props {
  error: Error;
}

// Rendered by the root layout when startup failed repeatedly. It sits outside
// AuthProvider and QueryClientProvider, so it must not use hooks that need them.
export function StartupRecoveryScreen({ error }: Props) {
  // Checked once: the screen is shown after startup failed and nothing else
  // touches the rollback folder until the app reloads.
  const [canUndoRestore] = React.useState(() => {
    try {
      return hasRestoreToUndo();
    } catch {
      return false;
    }
  });

  const handleTryAgain = async () => {
    await resetStartupFailureCount();
    try {
      await Updates.reloadAsync();
    } catch (reloadError) {
      Bugsnag.notify(
        reloadError instanceof Error
          ? reloadError
          : new Error(String(reloadError)),
      );
    }
  };

  const handleUndoRestore = () => {
    Alert.alert(
      t`Undo last restore?`,
      t`This brings back the training data that was on this device before the restore. The restored backup stays in the cloud.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Undo restore`,
          style: "destructive",
          onPress: async () => {
            try {
              await undoLastRestoreAndReload();
            } catch (undoError) {
              Bugsnag.notify(
                undoError instanceof Error
                  ? undoError
                  : new Error(String(undoError)),
              );
              Alert.alert(
                t`Error`,
                t`The restore could not be undone. Try again, or reset the data on this device.`,
              );
            }
          },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      t`Reset local data?`,
      t`All training history on this device will be deleted. It can only be recovered from a cloud backup, which you can restore from Settings after the reset.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Reset`,
          style: "destructive",
          onPress: async () => {
            await resetStartupFailureCount();
            await removeAsyncStorageItem(DATABASE_RESTORED_KEY);
            await clearDatabaseAndReinitialize();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="subtitle" style={styles.centered}>
          <Trans>MuscleQuest couldn't open your training data.</Trans>
        </ThemedText>
        <ThemedText style={styles.centered}>
          <Trans>
            Try again first. If the problem keeps happening, you can reset the
            data on this device.
          </Trans>
        </ThemedText>
        <ThemedText selectable style={styles.errorText}>
          {error.message}
        </ThemedText>
        <AppButton onPress={handleTryAgain}>
          <Trans>Try again</Trans>
        </AppButton>
        {canUndoRestore && (
          <>
            <ThemedText style={styles.centered}>
              <Trans>
                This started after a backup restore. Undoing it brings back the
                data from before the restore.
              </Trans>
            </ThemedText>
            <AppButton variant="secondary" onPress={handleUndoRestore}>
              <Trans>Undo last restore</Trans>
            </AppButton>
          </>
        )}
        <AppButton variant="danger" onPress={handleReset}>
          <Trans>Reset local data</Trans>
        </AppButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    padding: 24,
  },
  content: {
    gap: 16,
  },
  centered: {
    textAlign: "center",
  },
  errorText: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: "center",
  },
});
