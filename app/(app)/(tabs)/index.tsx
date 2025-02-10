import { StyleSheet, View, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { startOfWeek, endOfWeek } from "date-fns";
import { ActivityIndicator, Button, Portal, Modal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import React, { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { Colors } from "@/constants/Colors";
import { useActivePlanQuery } from "@/hooks/useActivePlanQuery";
import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import Onboarding from "@/components/Onboarding";

export default function HomeScreen() {
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
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

  const weightUnit = settings?.weightUnit || "kg";
  const {
    data: completedWorkouts,
    isLoading: completedWorkoutsLoading,
    error: completedWorkoutsError,
  } = useCompletedWorkoutsQuery(weightUnit);

  const activeWorkoutId = useActiveWorkoutStore((state) =>
    state.getActiveWorkoutId(),
  );

  const today = new Date();
  const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 });
  const endOfWeekDate = endOfWeek(today, { weekStartsOn: 1 });

  // Filter workouts completed this week
  const completedWorkoutsThisWeek = completedWorkouts?.filter(
    (workout) =>
      new Date(workout.date_completed) >= startOfWeekDate &&
      new Date(workout.date_completed) <= endOfWeekDate,
  );

  // Create a Set to track unique workout dates
  const uniqueWorkoutDays = new Set(
    completedWorkoutsThisWeek?.map((workout) =>
      new Date(workout.date_completed).toDateString(),
    ),
  );

  // Get the number of unique days worked out
  const uniqueWorkoutDaysCount = uniqueWorkoutDays.size;

  const weeklyGoalReached =
    uniqueWorkoutDaysCount === Number(settings?.weeklyGoal);

  if (activePlanLoading || settingsLoading || completedWorkoutsLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  } else if (activePlanError || settingsError || completedWorkoutsError) {
    const error = activePlanError || settingsError || completedWorkoutsError;

    if (error) {
      Bugsnag.notify(error);
    }
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

  let completedWorkoutsThisPlanThisWeek: CompletedWorkout[] = [];
  let workoutsToDisplay: Workout[] = [];

  if (activePlan) {
    // Sort workouts based on their id to maintain a consistent order
    const sortedWorkouts = [...activePlan.workouts].sort(
      (a, b) => (a.id ?? 0) - (b.id ?? 0),
    );

    // Filter completed workouts for the active plan this week
    completedWorkoutsThisPlanThisWeek =
      completedWorkoutsThisWeek?.filter(
        (workout) => String(workout.plan_id) === String(activePlan.id),
      ) || [];

    // Create a map to count how many times each workout has been completed
    const completedWorkoutCounts = new Map<number, number>();

    completedWorkoutsThisPlanThisWeek.forEach((completedWorkout) => {
      const count =
        completedWorkoutCounts.get(completedWorkout.workout_id) || 0;
      completedWorkoutCounts.set(completedWorkout.workout_id, count + 1);
    });

    // Separate workouts into uncompleted and completed arrays
    const uncompletedWorkouts: Workout[] = [];
    const completedWorkoutsList: Workout[] = [];

    sortedWorkouts.forEach((workout) => {
      // Determine if the workout is completed enough times
      const weeklyGoal = Number(settings?.weeklyGoal);
      const workoutsToComplete =
        activePlan.workouts.length < weeklyGoal
          ? Math.ceil(weeklyGoal / activePlan.workouts.length)
          : 1;

      const completedTimes = completedWorkoutCounts.get(workout.id!) || 0;

      const workoutCompleted = completedTimes >= workoutsToComplete;

      if (workoutCompleted) {
        completedWorkoutsList.push(workout);
      } else {
        uncompletedWorkouts.push(workout);
      }
    });

    // Combine uncompleted and completed workouts
    workoutsToDisplay = [...uncompletedWorkouts, ...completedWorkoutsList];
  }
  return (
    <ThemedView>
      {isStartingWorkout && (
        <Portal>
          <Modal visible={isStartingWorkout} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <ThemedText style={styles.loadingText}>
                Starting Workout...
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.weekContainer}>
          <WeekDays completedWorkoutsThisWeek={completedWorkoutsThisWeek} />
        </View>
        <View style={styles.summaryContainer}>
          <ThemedText style={styles.summaryText}>
            {uniqueWorkoutDaysCount} / {settings?.weeklyGoal} days worked out
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
          {activePlan && settings ? (
            <>
              {settings.showOnboarding === "true" && <Onboarding />}
              <ThemedText type="default" style={styles.sectionTitle}>
                Active Plan: {activePlan.name}
              </ThemedText>

              {workoutsToDisplay.map((workout, index) => {
                const weeklyGoal = parseInt(settings.weeklyGoal);
                const workoutsToComplete =
                  activePlan.workouts.length < weeklyGoal
                    ? Math.ceil(weeklyGoal / activePlan.workouts.length)
                    : 1;

                // Filter to check how many times this specific workout has been completed this week
                const completedTimes =
                  completedWorkoutsThisPlanThisWeek?.filter(
                    (completedWorkout) =>
                      completedWorkout.workout_id === workout.id,
                  ).length;

                // Condition to check if the workout is completed enough times
                const workoutCompleted = completedTimes >= workoutsToComplete;
                return (
                  <View key={index} style={styles.workoutCard}>
                    <View style={styles.workoutCardContent}>
                      <MaterialCommunityIcons
                        name={workoutCompleted ? "check" : "weight-lifter"}
                        size={30}
                        color={
                          workoutCompleted
                            ? Colors.dark.completed
                            : Colors.dark.icon
                        }
                      />
                      <View style={styles.workoutTextContainer}>
                        <ThemedText
                          type="subtitle"
                          style={styles.workoutCardTitle}
                        >
                          {workout.name}
                        </ThemedText>
                        <ThemedText style={styles.exerciseInfo}>
                          {workout.exercises.length} Exercises
                        </ThemedText>
                      </View>
                      <View style={styles.smallButtonGroup}>
                        <Button
                          mode={
                            index === 0 && !weeklyGoalReached
                              ? "contained"
                              : "outlined"
                          }
                          onPress={async () => {
                            if (isStartingWorkout) return; // Prevent multiple taps

                            setIsStartingWorkout(true);
                            await new Promise((resolve) =>
                              setTimeout(resolve, 50),
                            ); // Small delay for UX

                            try {
                              const activeWorkoutStore =
                                useActiveWorkoutStore.getState();

                              if (
                                activeWorkoutStore.isWorkoutInProgress() &&
                                activeWorkoutId === workout.id
                              ) {
                                activeWorkoutStore.resumeWorkout();
                              } else {
                                activeWorkoutStore.setWorkout(
                                  JSON.parse(JSON.stringify(workout)),
                                  activePlan.id!,
                                  workout.id!,
                                  workout.name || `Day ${index + 1}`,
                                );
                              }

                              router.push("/(workout)");
                            } finally {
                              setTimeout(
                                () => setIsStartingWorkout(false),
                                500,
                              ); // Prevent flickering
                            }
                          }}
                          labelStyle={styles.smallButtonLabel}
                          disabled={isStartingWorkout}
                        >
                          {activeWorkoutId === workout.id ? "Resume" : "Start"}
                        </Button>
                        {/* <Button
                        mode="outlined"
                        onPress={() =>
                          router.push(
                            `/workout-details?planId=${activePlan.id}&workoutIndex=${index}`,
                          )
                        }
                        labelStyle={styles.smallButtonLabel}
                      >
                        View
                      </Button> */}
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <Onboarding />
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
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Dark transparent overlay
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: "white",
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
    marginBottom: 10,
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
  smallButtonLabel: {
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
