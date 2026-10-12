import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { AppIcon } from "@/components/ui";
import { AppIconButton } from "@/components/ui/AppIconButton";
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

  const dismiss = () =>
    updateSetting({ key: SETUP_DONE_KEY, value: SetupState.done });

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t`Opens setup`}
        onPress={() => router.push("/setup")}
        style={styles.main}
      >
        <View style={styles.iconTile}>
          <AppIcon
            set="mci"
            name="tune-variant"
            size={22}
            color={colors.accent}
          />
        </View>
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
        <AppIcon
          set="mci"
          name="chevron-right"
          size={22}
          color={colors.contentSecondary}
        />
      </Pressable>
      <AppIconButton
        icon="close"
        size={18}
        accessibilityLabel={t`Dismiss`}
        onPress={dismiss}
        style={styles.dismiss}
      />
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      marginBottom: 16,
    },
    main: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingLeft: 14,
      // Room for the dismiss button in the corner.
      paddingRight: 36,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.accentSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    text: { flex: 1 },
    title: {
      color: colors.contentPrimary,
      fontWeight: "600",
    },
    message: {
      color: colors.contentSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    dismiss: {
      position: "absolute",
      top: 0,
      right: 0,
      margin: 2,
    },
  });
}
