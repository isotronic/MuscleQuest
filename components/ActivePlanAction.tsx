import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

type Props = {
  isActive: boolean;
  onActivate: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The active plan gets a status chip instead of a button that would do nothing.
export function ActivePlanAction({
  isActive,
  onActivate,
  disabled,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isActive) {
    return (
      <View style={[style, styles.chip]} accessible accessibilityRole="text">
        <AppIcon
          set="mci"
          name="check-circle"
          size={18}
          color={colors.success}
        />
        <ThemedText style={styles.chipText}>
          <Trans>Active plan</Trans>
        </ThemedText>
      </View>
    );
  }

  return (
    <Button
      mode="contained"
      onPress={onActivate}
      disabled={disabled}
      style={style}
      labelStyle={styles.buttonLabel}
    >
      <Trans>Set as active plan</Trans>
    </Button>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.success,
    },
    chipText: {
      color: colors.contentPrimary,
      fontWeight: "600",
    },
    buttonLabel: {
      paddingVertical: 0,
    },
  });
}
