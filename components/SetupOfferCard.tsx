import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { AppIcon } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { SETUP_DONE_KEY, SetupState } from "@/utils/setupState";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

/**
 * Offers the setup screen once to an install from before it existed. Nothing
 * changes unless the user opens it and saves; dismissing hides the card.
 */
export function SetupOfferCard() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: settings } = useSettingsQuery();
  const { mutate: updateSetting } = useUpdateSettingsMutation();

  if (settings?.setupDone !== SetupState.offered) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppIcon
          set="mci"
          name="tune-variant"
          size={24}
          color={colors.accent}
        />
        <View style={styles.text}>
          <ThemedText style={styles.title}>
            <Trans>Check your units and week start</Trans>
          </ThemedText>
          <ThemedText style={styles.message}>
            <Trans>
              Your weight steps, weekly goal and body weight are there too.
              Nothing changes unless you save.
            </Trans>
          </ThemedText>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          mode="text"
          compact
          onPress={() =>
            updateSetting({ key: SETUP_DONE_KEY, value: SetupState.done })
          }
        >
          <Trans>Dismiss</Trans>
        </Button>
        <Button mode="contained" compact onPress={() => router.push("/setup")}>
          <Trans>Check</Trans>
        </Button>
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
    text: { flex: 1 },
    title: {
      color: colors.contentPrimary,
      fontWeight: "600",
      marginBottom: 4,
    },
    message: {
      color: colors.contentSecondary,
      fontSize: 14,
    },
    buttons: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 4,
      marginTop: 12,
    },
  });
}
