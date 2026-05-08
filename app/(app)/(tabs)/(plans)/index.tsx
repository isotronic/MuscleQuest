import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB } from "react-native-paper";
import { useAllPlansQuery, Plan } from "@/hooks/useAllPlansQuery";
import { PlanList } from "@/components/PlanList";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import StandaloneWorkoutListItem from "@/components/StandaloneWorkoutListItem";
import { FlashList } from "@shopify/flash-list";
import { Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export default function PlansScreen() {
  const { data: plans, isLoading, isError, error } = useAllPlansQuery();
  const { data: standaloneWorkouts } = useStandaloneWorkoutsQuery();

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
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
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
          {standaloneWorkouts && standaloneWorkouts.length > 0 ? (
            <FlashList
              data={standaloneWorkouts}
              renderItem={({ item }) => (
                <StandaloneWorkoutListItem
                  workout={item}
                  onPress={() => handleViewWorkout(item)}
                />
              )}
              keyExtractor={(item) => item.id!.toString()}
              estimatedItemSize={76}
              scrollEnabled={false}
            />
          ) : (
            <ThemedText style={styles.emptyText}>No workouts yet</ThemedText>
          )}
        </View>
      </ScrollView>
      <FAB
        icon="dumbbell"
        label="Create Workout"
        theme={{ colors: { primary: Colors.dark.tint } }}
        style={styles.fabLeft}
        onPress={handleCreateWorkout}
      />
      <FAB
        icon="plus"
        label="Create Plan"
        theme={{ colors: { primary: Colors.dark.tint } }}
        style={styles.fab}
        onPress={handleCreatePlan}
      />
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
  fabLeft: {
    position: "absolute",
    left: 20,
    bottom: 15,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
});
