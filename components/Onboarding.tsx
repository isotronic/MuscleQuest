import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Button, Card } from "react-native-paper";
import { type Href, useRouter } from "expo-router";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { ThemedText } from "./ThemedText";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";

// Ready-made plans suggested to a brand new user, by app_plan_id.
const STARTER_PLANS: { appPlanId: number; description: MessageDescriptor }[] = [
  {
    appPlanId: 1,
    description: msg`Your whole body three times a week. A good first plan.`,
  },
  {
    appPlanId: 2,
    description: msg`Upper and lower body on alternating days.`,
  },
  {
    appPlanId: 5,
    description: msg`No equipment needed. Train anywhere.`,
  },
];

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

type Tip = { text: MessageDescriptor; link: MessageDescriptor; route: Href };

// Three short tips; setup already covered units, goal and week start.
const TIPS: Tip[] = [
  {
    text: msg`Start from a ready-made plan, or build your own with your exercises, reps and rest.`,
    link: msg`Explore plans`,
    route: "/(app)/(tabs)/(plans)",
  },
  {
    text: msg`Keep form cues on exercises and plans. A set note shows up the next time you do that exercise.`,
    link: msg`Exercise library`,
    route: "/(app)/exercise-library",
  },
  {
    text: msg`Stats shows your history, muscle split and how each exercise improves.`,
    link: msg`View stats`,
    route: "/(app)/(tabs)/(stats)",
  },
];

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
  const { data: plans } = useAllPlansQuery();

  const starterPlans = STARTER_PLANS.flatMap(({ appPlanId, description }) => {
    const plan = plans?.appPlans.find((p) => p.app_plan_id === appPlanId);
    return plan ? [{ plan, description }] : [];
  });

  return (
    <View style={styles.container}>
      {showActivationCard && (
        <Card style={styles.card}>
          <Card.Content>
            <ThemedText type="subtitle" style={styles.title}>
              <Trans>Pick a plan to get started</Trans>
            </ThemedText>
            {starterPlans.map(({ plan, description }) => (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                style={styles.planRow}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/(plans)/overview",
                    params: { planId: String(plan.id) },
                  })
                }
              >
                <ThemedText style={styles.planName}>{plan.name}</ThemedText>
                <ThemedText style={styles.planMeta}>
                  <Plural
                    value={plan.workouts.length}
                    one="# day per week"
                    other="# days per week"
                  />
                </ThemedText>
                <ThemedText style={styles.planMeta}>
                  {_(description)}
                </ThemedText>
              </Pressable>
            ))}
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
        <Card style={styles.card}>
          <Card.Content>
            <ThemedText type="subtitle" style={styles.title}>
              <Trans>Tips</Trans>
            </ThemedText>
            {TIPS.map((tip) => (
              <View key={tip.route as string} style={styles.tip}>
                <ThemedText style={styles.tipText}>{_(tip.text)}</ThemedText>
                <Button
                  mode="text"
                  compact
                  onPress={() => router.push(tip.route)}
                  style={styles.tipLink}
                >
                  {_(tip.link)}
                </Button>
              </View>
            ))}
            {onHideTips && (
              <Button
                mode="outlined"
                onPress={onHideTips}
                style={styles.button}
              >
                <Trans>Hide tips</Trans>
              </Button>
            )}
          </Card.Content>
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
    planRow: {
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    planName: {
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    planMeta: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    tip: {
      marginBottom: 8,
    },
    tipText: {
      color: colors.contentPrimary,
    },
    tipLink: {
      alignSelf: "flex-start",
    },
  });
}

export default Onboarding;
