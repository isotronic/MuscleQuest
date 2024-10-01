import { StyleSheet, View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { startOfWeek, endOfWeek } from "date-fns";
import { ActivityIndicator, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { Colors } from "@/constants/Colors";
import { useActivePlanQuery } from "@/hooks/useActivePlanQuery";
import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useCompletedWorkoutsQuery } from "@/hooks/useCompletedWorkoutsQuery";

export default function HomeScreen() {
  const user = useContext(AuthContext);
  const userName = user?.displayName
    ? ", " + user.displayName.split(" ")[0]
    : "";

  const {
    data: activePlan,
    isLoading: activePlanLoading,
    error: activePlanError,
  } = useActivePlanQuery();
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();
  const {
    data: completedWorkouts,
    isLoading: completedWorkoutsLoading,
    error: completedWorkoutsError,
  } = useCompletedWorkoutsQuery();

  const today = new Date();
  const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 });
  const endOfWeekDate = endOfWeek(today, { weekStartsOn: 1 });

  // Filter workouts completed this week
  const completedWorkoutsThisWeek = completedWorkouts?.filter(
    (workout) =>
      new Date(workout.date_completed) >= startOfWeekDate &&
      new Date(workout.date_completed) <= endOfWeekDate,
  );

  if (activePlanLoading || settingsLoading || completedWorkoutsLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  } else if (activePlanError || settingsError || completedWorkoutsError) {
    const error = activePlanError || settingsError || completedWorkoutsError;
    return (
      <ThemedText style={styles.loadingContainer}>
        Error fetching{" "}
        {activePlanError
          ? "active plan"
          : settingsError
            ? "settings"
            : "completed workouts"}
        : {error?.message}
      </ThemedText>
    );
  }

  return (
    <ThemedView>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.weekContainer}>
          <WeekDays completedWorkoutsThisWeek={completedWorkoutsThisWeek} />
        </View>
        <View style={styles.summaryContainer}>
          <ThemedText style={styles.summaryText}>
            {completedWorkoutsThisWeek?.length} / {settings?.weeklyGoal} days
            worked out
          </ThemedText>
        </View>
        <View style={styles.welcomeContainer}>
          <ThemedText type="subtitle">
            Welcome{activePlan && " back"}
            {userName}
          </ThemedText>
          <ThemedText type="default">
            {!activePlan
              ? "Your journey to Swoletown begins today!"
              : "Make sure to track your progress!"}
          </ThemedText>
        </View>

        <View style={styles.cardContainer}>
          {activePlan ? (
            <>
              <ThemedText type="default" style={styles.sectionTitle}>
                Active Plan: {activePlan.name}
              </ThemedText>

              {activePlan.plan_data.map((workout, index) => (
                <View key={index} style={styles.workoutCard}>
                  <View style={styles.workoutCardContent}>
                    <MaterialCommunityIcons
                      name="weight-lifter"
                      size={30}
                      color={Colors.dark.icon}
                    />
                    <View style={styles.workoutTextContainer}>
                      <ThemedText
                        type="subtitle"
                        style={styles.workoutCardTitle}
                      >
                        {workout.name || `Day ${index + 1}`}
                      </ThemedText>
                      <ThemedText style={styles.exerciseInfo}>
                        {workout.exercises.length} Exercises
                      </ThemedText>
                    </View>
                    <View style={styles.smallButtonGroup}>
                      <Button
                        mode="contained"
                        onPress={() => {
                          useActiveWorkoutStore
                            .getState()
                            .setWorkout(workout, activePlan.id, workout.name);
                          router.push("/(workout)");
                        }}
                        style={styles.smallButton}
                        labelStyle={styles.smallButtonLabel}
                      >
                        Start
                      </Button>
                      {/* <Button
                        mode="outlined"
                        onPress={() =>
                          router.push(
                            `/workout-details?planId=${activePlan.id}&workoutIndex=${index}`,
                          )
                        }
                        style={styles.smallButton}
                        labelStyle={styles.smallButtonLabel}
                      >
                        View
                      </Button> */}
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View>
              <ThemedText type="default" style={styles.sectionTitle}>
                No Active Plan.
              </ThemedText>
              <ThemedText type="default" style={styles.sectionTitle}>
                Create or choose one now.
              </ThemedText>
              <View style={styles.buttonContainer}>
                <Button
                  mode="contained"
                  onPress={() => router.push("/(plans)")}
                >
                  Go to Plans
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            textColor={Colors.dark.text}
            icon={() => (
              <MaterialCommunityIcons
                name="arm-flex"
                size={25}
                color={Colors.dark.icon}
              />
            )}
            onPress={() => console.log("Start a workout pressed")}
            style={styles.startWorkoutButton}
            labelStyle={styles.buttonLabel}
          >
            Quickstart workout
          </Button>
        </View> */}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  weekContainer: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: Colors.dark.background,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.dark.background,
  },
  summaryText: {
    fontSize: 16,
    textAlign: "right",
  },
  welcomeContainer: {
    padding: 16,
  },
  cardContainer: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  workoutCard: {
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
  },
  workoutCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workoutTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  workoutCardTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "bold",
  },
  exerciseInfo: {
    color: Colors.dark.subText,
    fontSize: 14,
  },
  smallButtonGroup: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  smallButton: {
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  smallButtonLabel: {
    fontSize: 16,
    paddingVertical: 0,
  },
  buttonContainer: {
    padding: 16,
  },
  startWorkoutButton: {
    borderRadius: 15,
    width: "100%",
    height: 50,
  },
  buttonLabel: {
    fontSize: 18,
    lineHeight: 27,
  },
});
