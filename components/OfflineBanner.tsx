import React, { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Trans } from "@lingui/react/macro";
import { AppIcon, AppText } from "@/components/ui";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useAppTheme, radii } from "@/theme";

/**
 * Slim notice shown only while the device is offline. The default copy is for
 * the social screens; pass `message` for anywhere else.
 */
export function OfflineBanner({ message }: { message?: ReactNode }) {
  const isOnline = useIsOnline();
  const { colors } = useAppTheme();
  if (isOnline) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.card }]}
      accessibilityRole="alert"
    >
      <AppIcon
        set="mci"
        name="cloud-off-outline"
        size={18}
        color={colors.contentSecondary}
      />
      <AppText
        variant="caption"
        style={[styles.text, { color: colors.contentSecondary }]}
      >
        {message ?? (
          <Trans>
            You're offline. Friends and shared content will load when you
            reconnect. Training and logging still work.
          </Trans>
        )}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  text: { flex: 1 },
});
