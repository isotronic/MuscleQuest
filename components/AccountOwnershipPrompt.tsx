import { useContext, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { AuthContext } from "@/context/AuthProvider";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { showSnackbar } from "@/store/snackbarStore";
import {
  claimLocalData,
  dismissOwnershipPrompt,
} from "@/utils/accountOwnership";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * Asks before training data recorded with another account is backed up or
 * shared as the one that just signed in. Shown by resolveAccountOwnership.
 */
export function AccountOwnershipPrompt() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useContext(AuthContext);
  const visible = useAccountOwnershipStore((s) => s.promptVisible);

  if (!visible || !user) return null;

  const claim = async () => {
    try {
      await claimLocalData(user.uid);
    } catch (error) {
      notifyBugsnag(error);
      showSnackbar(t`Couldn't save your choice. Try again from Settings.`);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={dismissOwnershipPrompt}
        contentContainerStyle={styles.modal}
        theme={{ colors: { backdrop: colors.modalBackdrop } }}
      >
        <ThemedText
          accessibilityRole="header"
          type="subtitle"
          style={styles.title}
        >
          <Trans>Use this device's data with this account?</Trans>
        </ThemedText>
        <ThemedText style={styles.body}>
          <Trans>
            The training history on this device was used with another account.
            Backups and sharing are paused until you choose.
          </Trans>
        </ThemedText>
        <View style={styles.buttons}>
          <Button
            mode="contained"
            theme={{ colors: { primary: colors.accent } }}
            onPress={claim}
            testID="ownership-claim"
          >
            <Trans>Use with this account</Trans>
          </Button>
          <Button
            mode="text"
            onPress={dismissOwnershipPrompt}
            testID="ownership-not-now"
          >
            <Trans>Not now</Trans>
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
