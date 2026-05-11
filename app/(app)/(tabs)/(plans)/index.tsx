import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";
import { useAllPlansQuery, Plan } from "@/hooks/useAllPlansQuery";
import { PlanList } from "@/components/PlanList";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import StandaloneWorkoutListItem from "@/components/StandaloneWorkoutListItem";
import { Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export default function PlansScreen() {
  const { data: plans, isLoading, isError, error } = useAllPlansQuery();
  const {
    data: standaloneWorkouts,
    isLoading: standaloneIsLoading,
    isError: standaloneIsError,
    error: standaloneError,
  } = useStandaloneWorkoutsQuery();

  useEffect(() => {
    if (standaloneIsError && standaloneError) {
      Bugsnag.notify(standaloneError as Error);
    }
  }, [standaloneIsError, standaloneError]);

  const handleCreatePlan = () => {
    router.push("/(app)/(create-plan)/create");
  };

  const handleCreateWorkout = () => {
    router.push("/(app)/(create-plan)/create-workout");
  };

  const handleViewPlan = (item: Plan) => {
    router.push(`/overview?planId=${item.id}`);
  };

  const handleViewWorkout = (workout: Workout) => {
    router.push({
      pathname: "/(app)/(tabs)/(plans)/standalone-workout",
      params: { workoutId: workout.id!.toString() },
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (isError) {
    Bugsnag.notify(error);
    return <ThemedText>Error loading plans</ThemedText>;
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Button
                mode="outlined"
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                onPress={handleCreateWorkout}
              >
                New Workout
              </Button>
              <Button
                mode="contained"
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                onPress={handleCreatePlan}
              >
                New Plan
              </Button>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PlanList
          title="Your training plans"
          data={plans?.userPlans}
          onPressItem={handleViewPlan}
        />
        <PlanList
          title="Premade plans"
          data={plans?.appPlans}
          onPressItem={handleViewPlan}
        />
        <View style={styles.workoutsSection}>
          <ThemedText style={styles.sectionTitle}>Your workouts</ThemedText>
          {standaloneIsLoading ? (
            <ActivityIndicator size="small" color={Colors.dark.text} />
          ) : standaloneIsError ? (
            <ThemedText style={styles.emptyText}>
              Failed to load workouts
            </ThemedText>
          ) : standaloneWorkouts && standaloneWorkouts.length > 0 ? (
            standaloneWorkouts.map((item) => (
              <StandaloneWorkoutListItem
                key={item.id!.toString()}
                workout={item}
                onPress={() => handleViewWorkout(item)}
              />
            ))
          ) : (
            <ThemedText style={styles.emptyText}>No workouts yet</ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  workoutsSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  emptyText: {
    color: Colors.dark.subText,
    fontSize: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: Colors.dark.text,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
    marginRight: 4,
  },
  buttonContent: {
    height: 34,
  },
  buttonLabel: {
    fontSize: 14,
    marginVertical: 0,
  },
});
