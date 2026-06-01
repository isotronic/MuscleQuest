import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Plan } from "@/hooks/useAllPlansQuery";
import { AppIcon } from "@/components/ui";
import { Plural } from "@lingui/react/macro";
import { Trans } from "@lingui/react/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface TrainingPlanListItemProps {
  plan: Plan;
  onPress: () => void;
  isPublished?: boolean;
}

export default function TrainingPlanListItem({
  plan,
  onPress,
  isPublished,
}: TrainingPlanListItemProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isActive = plan.is_active === 1 || plan.is_active === true;

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Training plan ${plan.name}`}
    >
      <View style={styles.imageContainer}>
        {plan.image_url ? (
          <Card.Cover style={styles.image} source={{ uri: plan.image_url }} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <AppIcon
              set="mci"
              name="dumbbell"
              size={32}
              color={colors.contentSecondary}
            />
          </View>
        )}
      </View>
      <View style={styles.textContainer}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {plan.name}
          </ThemedText>
          {isActive && (
            <View style={styles.activeBadge}>
              <ThemedText style={styles.activeBadgeText}>
                <Trans>Active</Trans>
              </ThemedText>
            </View>
          )}
          {isPublished && (
            <AppIcon
              set="mci"
              name="cloud-check"
              size={16}
              color={colors.accent}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
        <ThemedText style={styles.subtitle}>
          <Plural
            value={plan.workouts.length}
            one="# workout"
            other="# workouts"
          />
        </ThemedText>
      </View>
      <AppIcon
        set="mci"
        name="chevron-right"
        size={22}
        color={colors.contentSecondary}
      />
    </Pressable>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 10,
    },
    imageContainer: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      overflow: "hidden",
      marginRight: 14,
    },
    image: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
    },
    imagePlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      justifyContent: "center",
      alignItems: "center",
    },
    textContainer: {
      flex: 1,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      flexShrink: 1,
    },
    subtitle: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    activeBadge: {
      backgroundColor: colors.success,
      paddingHorizontal: 6,
      marginLeft: 8,
      borderRadius: radii.sm,
    },
    activeBadgeText: {
      fontSize: 11,
      fontWeight: "bold",
      color: colors.contentPrimary,
    },
  });
}
