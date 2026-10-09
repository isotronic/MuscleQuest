import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { AppIcon } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { showSnackbar } from "@/store/snackbarStore";
import { claimLocalData } from "@/utils/accountOwnership";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { useAppTheme } from "@/theme";

/**
 * Settings row shown while backups and sharing are paused because the data on
 * this device was used with another account. Offers the same choice as
 * AccountOwnershipPrompt, for someone who picked "Not now" there.
 */
export function AccountOwnershipNotice({
  user,
}: {
  user: FirebaseAuthTypes.User | null;
}) {
  const { colors } = useAppTheme();
  const paused = useAccountOwnershipStore(
    (s) => !!user && s.resolvedFor === user.uid && !s.ownedByCurrentUser,
  );

  if (!user || !paused) return null;

  const claim = async () => {
    try {
      await claimLocalData(user.uid);
    } catch (error) {
      notifyBugsnag(error);
      showSnackbar(t`Couldn't save your choice. Try again.`);
    }
  };

  return (
    <View style={styles.row} testID="ownership-notice">
      <AppIcon
        set="mci"
        name="account-alert-outline"
        size={24}
        color={colors.accent}
        style={styles.icon}
      />
      <View style={styles.text}>
        <ThemedText style={{ fontSize: 16, color: colors.contentPrimary }}>
          <Trans>Backups and sharing are paused</Trans>
        </ThemedText>
        <ThemedText style={{ fontSize: 14, color: colors.contentSecondary }}>
          <Trans>The data on this device was used with another account.</Trans>
        </ThemedText>
      </View>
      <Button
        mode="outlined"
        compact
        onPress={claim}
        testID="ownership-notice-claim"
      >
        <Trans>Use with this account</Trans>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the rows of the settings screen.
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
});
