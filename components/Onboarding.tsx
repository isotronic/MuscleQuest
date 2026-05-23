import React, { useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Button, Text, Card } from "react-native-paper";
import { type Href, useRouter } from "expo-router";
import { t } from "@lingui/core/macro";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "./ThemedText";

const Onboarding = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const onboardingData = [
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
      title: t`Add Personal Notes`,
      description: t`Capture important cues, reminders, and personal insights for your exercises, workouts, and training plans. Stay focused and refine your technique with custom notes throughout your fitness journey. Notes save automatically when you're done editing.`,
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
      title: t`Single & Quick Workouts`,
      description: t`Train without a plan! Create standalone workouts that live outside your training plans — perfect for mobility sessions, warm-ups, or anything ad hoc.\n\nOr jump straight into a Quick Workout from the home screen, add exercises on the fly, and optionally save it as a standalone workout when you're done.`,
      buttonLabel: t`Go to Workouts` as string | null,
      route: "/(app)/(tabs)/(plans)" as Href,
    },
    {
      title: t`Hide / Show Onboarding`,
      description: t`You can hide this onboarding screen at any time from the settings page in the appearance section. If you ever want to revisit the onboarding, you can enable it again from the same settings page.`,
      buttonLabel: t`Go to Settings` as string | null,
      route: "/(app)/settings" as Href,
    },
  ];

  const handleNavigate = (route: Href | null) => {
    if (route) {
      router.push(route);
    }
  };

  const renderCard = ({ item }: { item: (typeof onboardingData)[0] }) => (
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
        keyExtractor={(item: (typeof onboardingData)[0], index: number) =>
          index.toString()
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

const styles = StyleSheet.create({
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
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 8,
    elevation: 5,
  },
  title: {
    textAlign: "center",
    marginBottom: 16,
    color: Colors.dark.text,
  },
  description: {
    textAlign: "center",
    marginBottom: 24,
    color: Colors.dark.text,
  },
  button: {
    marginTop: 8,
  },
  pagination: {
    fontSize: 20,
    textAlign: "center",
    color: Colors.dark.text,
  },
});

export default Onboarding;
