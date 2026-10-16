import React, { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, Card } from "react-native-paper";
import type { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { msg, t } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ThemedText } from "./ThemedText";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { StarterPlanList } from "./StarterPlanList";

/**
 * The pick-a-plan card is for someone who has never trained with the app:
 * no active plan and no completed workouts (once history has loaded).
 */
export const shouldShowActivationCard = (
  hasActivePlan: boolean,
  /** undefined while the check is still loading. */
  hasCompletedWorkout: boolean | undefined,
) => !hasActivePlan && hasCompletedWorkout === false;

interface OnboardingProps {
  /** Shown to a new user: no active plan and no completed workouts yet. */
  showActivationCard?: boolean;
  onQuickWorkout?: () => void;
  /** The tips card; the "Show tips on home" setting. */
  showTips?: boolean;
  onHideTips?: () => void;
}

type Tip = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: MessageDescriptor;
  text: MessageDescriptor;
  link: MessageDescriptor;
  route: Href;
};

// Short tips, one at a time; setup already covered units, goal and week start.
export const TIPS: Tip[] = [
  {
    icon: "clipboard-list-outline",
    title: msg`Follow a plan`,
    text: msg`Start from a ready-made plan, or build your own with your exercises, reps and rest.`,
    link: msg`Explore plans`,
    route: "/(app)/(tabs)/(plans)",
  },
  {
    icon: "lightbulb-on-outline",
    title: msg`Cues and notes`,
    text: msg`Keep form cues on exercises and plans. A set note shows up the next time you do that exercise.`,
    link: msg`Exercise library`,
    route: "/(app)/exercise-library",
  },
  {
    icon: "chart-line",
    title: msg`See your progress`,
    text: msg`Stats shows your history, muscle split and how each exercise improves.`,
    link: msg`View stats`,
    route: "/(app)/(tabs)/(stats)",
  },
  {
    icon: "history",
    title: msg`Trained without the app?`,
    text: msg`Add a past session afterwards so your history and streak stay complete.`,
    link: msg`Log past workout`,
    route: "/(app)/log-workout",
  },
  {
    icon: "view-dashboard-edit-outline",
    title: msg`Make Stats yours`,
    text: msg`Show, hide and reorder the cards on the Stats tab.`,
    link: msg`Customize stats`,
    route: "/(app)/(tabs)/(stats)/customize",
  },
  {
    icon: "cloud-upload-outline",
    title: msg`Keep a backup`,
    text: msg`Sign in to back up your training and bring it to a new phone.`,
    link: msg`Data and backup`,
    route: "/(app)/settings/data",
  },
];

/** A different tip each local day, the same one all day. */
export const tipIndexForDay = (date: Date, count: number) => {
  const day = Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return day % count;
};

const Onboarding = ({
  showActivationCard = false,
  onQuickWorkout,
  showTips = true,
  onHideTips,
}: OnboardingProps) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { _ } = useLingui();
  const [tipIndex, setTipIndex] = useState(() =>
    tipIndexForDay(new Date(), TIPS.length),
  );
  const tip = TIPS[tipIndex];

  return (
    <View style={styles.container}>
      {showActivationCard && (
        <Card style={styles.card}>
          <Card.Content>
            <ThemedText type="subtitle" style={styles.title}>
              <Trans>Pick a plan to get started</Trans>
            </ThemedText>
            <StarterPlanList
              onSelect={(planId) =>
                router.push({
                  pathname: "/(app)/(tabs)/(plans)/overview",
                  params: { planId: String(planId) },
                })
              }
            />
            {onQuickWorkout && (
              <Button
                mode="text"
                onPress={onQuickWorkout}
                style={styles.button}
              >
                <Trans>Or start a quick workout</Trans>
              </Button>
            )}
          </Card.Content>
        </Card>
      )}
      {showTips && (
        <Card style={[styles.card, styles.tipCard]}>
          <View style={styles.tipHeader}>
            <ThemedText style={styles.eyebrow}>
              <Trans>Tips</Trans>
            </ThemedText>
            {onHideTips && (
              <AppIconButton
                icon="close"
                size={18}
                accessibilityLabel={t`Hide tips`}
                onPress={onHideTips}
                style={styles.iconButton}
              />
            )}
          </View>
          <View style={styles.tipBody}>
            <View style={styles.tipIcon}>
              <AppIcon
                set="mci"
                name={tip.icon}
                size={24}
                color={colors.accent}
              />
            </View>
            <View style={styles.tipTextBlock}>
              <ThemedText style={styles.tipTitle}>{_(tip.title)}</ThemedText>
              <ThemedText style={styles.tipText}>{_(tip.text)}</ThemedText>
            </View>
          </View>
          <View style={styles.tipFooter}>
            <Button
              mode="text"
              compact
              icon="arrow-right"
              contentStyle={styles.tipLinkContent}
              onPress={() => router.push(tip.route)}
            >
              {_(tip.link)}
            </Button>
            <View style={styles.tipNav}>
              <View
                style={styles.dots}
                accessible
                accessibilityLabel={t`Tip ${tipIndex + 1} of ${TIPS.length}`}
              >
                {TIPS.map((item, i) => (
                  <View
                    key={item.route as string}
                    style={[styles.dot, i === tipIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <AppIconButton
                icon="chevron-right"
                size={22}
                accessibilityLabel={t`Next tip`}
                onPress={() => setTipIndex((i) => (i + 1) % TIPS.length)}
                style={styles.iconButton}
              />
            </View>
          </View>
        </Card>
      )}
    </View>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 16,
      paddingBottom: 16,
    },
    card: {
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      elevation: 5,
    },
    title: {
      textAlign: "center",
      marginBottom: 16,
      color: colors.contentPrimary,
    },
    button: {
      marginTop: 8,
    },
    tipCard: {
      paddingVertical: 8,
    },
    tipHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.accent,
    },
    iconButton: {
      margin: 0,
    },
    tipBody: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    tipIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.accentSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    tipTextBlock: {
      flex: 1,
    },
    tipTitle: {
      fontWeight: "600",
      color: colors.contentPrimary,
      marginBottom: 2,
    },
    tipText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.contentSecondary,
    },
    tipFooter: {
      flexDirection: "row",
      // A long translated link pushes the controls to their own line.
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 8,
      paddingRight: 12,
      marginTop: 8,
    },
    tipLinkContent: {
      flexDirection: "row-reverse",
    },
    tipNav: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dots: {
      flexDirection: "row",
      gap: 5,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accentBorder,
    },
    dotActive: {
      width: 14,
      backgroundColor: colors.accent,
    },
  });
}

export default Onboarding;
