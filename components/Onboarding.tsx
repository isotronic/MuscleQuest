import React, { useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { Button, Text, Card } from "react-native-paper";
import { type Href, useRouter } from "expo-router";
import { msg, t } from "@lingui/core/macro";
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
}

type InfoCard = {
  kind: "info";
  title: string;
  description: string;
  buttonLabel: string | null;
  route: Href | null;
};
type CardItem = { kind: "activation" } | InfoCard;

const Onboarding = ({
  showActivationCard = false,
  onQuickWorkout,
}: OnboardingProps) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const { _ } = useLingui();
  const { data: plans } = useAllPlansQuery();

  const starterPlans = STARTER_PLANS.flatMap(({ appPlanId, description }) => {
    const plan = plans?.appPlans.find((p) => p.app_plan_id === appPlanId);
    return plan ? [{ plan, description }] : [];
  });

  const infoCards: Omit<InfoCard, "kind">[] = [
    {
      title: t`MuscleQuest Introduction`,
      description: t`Track your workouts, monitor progress, and achieve your fitness goals. MuscleQuest makes your fitness journey simple and effective.\n\nSwipe through the introduction cards to learn more about the app.`,
      buttonLabel: null as string | null,
      route: null as Href | null,
    },
    {
      title: t`Customise Your Settings`,
      description: t`Set your weekly workout goal and enter your body weight to get accurate stats and recommendations. You can also adjust your weight increment preferences, choose your preferred units, and much more.`,
      buttonLabel: t`Go to Settings` as string | null,
      route: "/(app)/settings" as Href,
    },
    {
      title: t`Track Your Progress`,
      description: t`Monitor your fitness journey with detailed stats and insights. Keep track of workout history, analyse your body part splits, and visualise improvements over time with exercise progression graphs.`,
      buttonLabel: t`View Stats` as string | null,
      route: "/(app)/(tabs)/(stats)" as Href,
    },
    {
      title: t`Cues and Notes`,
      description: t`Keep form cues and reminders on your exercises, workouts, and training plans. During a session, add a note to the whole workout or to a single set, and it shows up the next time you do that exercise. Notes stay on your device and save automatically when you're done editing.`,
      buttonLabel: null as string | null,
      route: null as Href | null,
    },
    {
      title: t`Create a Custom Plan`,
      description: t`Take full control of your training by designing your own personalised plan. Select exercises, set rep ranges, rest times, and more to create a plan that aligns perfectly with your fitness goals.`,
      buttonLabel: t`Create a Plan` as string | null,
      route: "/(app)/(create-plan)/create" as Href,
    },
    {
      title: t`Explore Ready-Made Plans`,
      description: t`Jumpstart your fitness journey with professionally designed training plans. Choose from a variety of options tailored to different goals and experience levels. `,
      buttonLabel: t`Explore Plans` as string | null,
      route: "/(app)/(tabs)/(plans)" as Href,
    },
    {
      title: t`Workouts and quick workouts`,
      description: t`Train without a plan. Save workouts outside your plans, or start a quick workout from home and add exercises as you go.`,
      buttonLabel: t`Go to Workouts` as string | null,
      route: "/(app)/(tabs)/(plans)" as Href,
    },
  ];

  const onboardingData: CardItem[] = [
    ...(showActivationCard ? [{ kind: "activation" } as const] : []),
    ...infoCards.map((card) => ({ kind: "info" as const, ...card })),
  ];

  const handleNavigate = (route: Href | null) => {
    if (route) {
      router.push(route);
    }
  };

  const renderActivationCard = () => (
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
            <ThemedText style={styles.planMeta}>{_(description)}</ThemedText>
          </Pressable>
        ))}
        {onQuickWorkout && (
          <Button mode="text" onPress={onQuickWorkout} style={styles.button}>
            <Trans>Or start a quick workout</Trans>
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  const renderCard = ({ item }: { item: CardItem }) =>
    item.kind === "activation" ? renderActivationCard() : renderInfoCard(item);

  const renderInfoCard = (item: InfoCard) => (
    <Card style={styles.card}>
      <Card.Content>
        <ThemedText type="subtitle" style={styles.title}>
          {item.title}
        </ThemedText>
        <ThemedText style={styles.description}>{item.description}</ThemedText>
        {item.buttonLabel && item.route && (
          <Button
            mode="contained"
            onPress={() => handleNavigate(item.route)}
            style={styles.button}
          >
            {item.buttonLabel}
          </Button>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={onboardingData}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: CardItem, index: number) =>
          item.kind === "activation" ? "activation" : index.toString()
        }
        renderItem={renderCard}
        onScroll={(e: {
          nativeEvent: {
            contentOffset: { x: number };
            layoutMeasurement: { width: number };
          };
        }) =>
          setCurrentIndex(
            Math.round(
              e.nativeEvent.contentOffset.x /
                e.nativeEvent.layoutMeasurement.width,
            ),
          )
        }
      />
      <Text style={styles.pagination}>
        {onboardingData.map((_, index) => (index === currentIndex ? "●" : "○"))}
      </Text>
    </View>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 16,
    },
    card: {
      width: 320,
      marginRight: 16,
      paddingVertical: 24,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      elevation: 5,
    },
    title: {
      textAlign: "center",
      marginBottom: 16,
      color: colors.contentPrimary,
    },
    description: {
      textAlign: "center",
      marginBottom: 24,
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
    pagination: {
      fontSize: 20,
      textAlign: "center",
      color: colors.contentPrimary,
    },
  });
}

export default Onboarding;
