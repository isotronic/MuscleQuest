import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { startOfWeek, endOfWeek, getDay } from "date-fns";
import { ActivityIndicator, Button, Portal, Modal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import React, { useContext, useEffect, useState } from "react";
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
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { UpdateModal } from "@/components/UpdateModal";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { usePlanScheduleQuery } from "@/hooks/usePlanScheduleQuery";
import RestDayCard from "@/components/RestDayCard";
import WorkoutDoneCard from "@/components/WorkoutDoneCard";
import {
  computeWeeklyTargets,
  prioritizeScheduledWorkout,
} from "@/utils/planHelpers";

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

  const { data: planScheduleEntries, isLoading: planScheduleLoading } =
    usePlanScheduleQuery(activePlan?.id ?? null);

  const activeWorkout = useActiveWorkoutStore((state) => state.activeWorkout);
  const workoutInProgress = useActiveWorkoutStore((state) =>
    Boolean(state.activeWorkout && state.workout),
  );
  const [showResumeCard, setShowResumeCard] = useState(workoutInProgress);

  useEffect(() => {
    if (!workoutInProgress) {
      setShowResumeCard(false);
      return;
    }
    const timer = setTimeout(() => setShowResumeCard(true), 1000);
    return () => clearTimeout(timer);
  }, [workoutInProgress]);

  const today = new Date();
  // day_of_week: 0=Mon … 6=Sun  (JS Sunday=0, so shift by +6 mod 7)
  const todayDow = (getDay(today) + 6) % 7;
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

  if (
    activePlanLoading ||
    settingsLoading ||
    completedWorkoutsLoading ||
    (!!activePlan && planScheduleLoading)
  ) {
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
  let isRestDay = false;
  let completedTodayWorkoutIds = new Set<number>();
  // Map of workoutId -> required completions per week
  const perWorkoutTarget = new Map<number, number>();

  if (activePlan) {
    const sortedWorkouts = activePlan.workouts;
    const weeklyGoal = Number(settings?.weeklyGoal ?? 0);

    // Build per-workout targets and determine rest-day status
    const { perWorkoutTarget: targets, isRestDay: restDay } =
      computeWeeklyTargets(
        sortedWorkouts,
        weeklyGoal,
        planScheduleEntries,
        todayDow,
      );
    targets.forEach((v, k) => perWorkoutTarget.set(k, v));
    isRestDay = restDay;

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

    // Track which workout IDs were completed today (for schedule prioritization)
    const todayDateStr = today.toDateString();
    completedTodayWorkoutIds = new Set<number>(
      completedWorkoutsThisPlanThisWeek
        .filter(
          (w) => new Date(w.date_completed).toDateString() === todayDateStr,
        )
        .map((w) => w.workout_id),
    );

    // Separate workouts into uncompleted and completed arrays
    const uncompletedWorkouts: Workout[] = [];
    const completedWorkoutsList: Workout[] = [];

    sortedWorkouts.forEach((workout) => {
      const target = perWorkoutTarget.get(workout.id!) ?? 0;
      const completedTimes = completedWorkoutCounts.get(workout.id!) || 0;
      const workoutCompleted = completedTimes >= target;

      if (workoutCompleted) {
        completedWorkoutsList.push(workout);
      } else {
        uncompletedWorkouts.push(workout);
      }
    });

    // If there's a schedule, put today's (or next scheduled) workout first
    const orderedUncompleted = prioritizeScheduledWorkout(
      uncompletedWorkouts,
      planScheduleEntries,
      todayDow,
      isRestDay,
      completedTodayWorkoutIds,
    );

    // Combine uncompleted and completed workouts
    workoutsToDisplay = [...orderedUncompleted, ...completedWorkoutsList];
  }

  const todayScheduledEntry = planScheduleEntries?.find(
    (e) => e.day_of_week === todayDow,
  );
  const showWorkoutDoneCard =
    !isRestDay &&
    !!planScheduleEntries &&
    !!activePlan &&
    !showResumeCard &&
    !!todayScheduledEntry &&
    completedTodayWorkoutIds.has(todayScheduledEntry.workout_id);

  return (
    <ThemedView>
      <WhatsNewModal />
      <UpdateModal />
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

        {isRestDay && planScheduleEntries && activePlan && !showResumeCard && (
          <View style={styles.restDayContainer}>
            <RestDayCard
              schedule={planScheduleEntries}
              workouts={activePlan.workouts}
              todayDow={todayDow}
            />
          </View>
        )}

        {showWorkoutDoneCard && (
          <View style={styles.restDayContainer}>
            <WorkoutDoneCard
              schedule={planScheduleEntries!}
              workouts={activePlan!.workouts}
              todayDow={todayDow}
            />
          </View>
        )}

        <View style={styles.cardContainer}>
          {showResumeCard && (
            <Pressable
              style={[
                styles.workoutCard,
                {
                  borderWidth: 1,
                  borderColor: Colors.dark.tint,
                  marginBottom: 32,
                },
              ]}
              onPress={() => router.push("/(app)/(workout)")}
            >
              <View style={styles.workoutCardContent}>
                <MaterialCommunityIcons
                  name={
                    activeWorkout?.planId != null ? "weight-lifter" : "arm-flex"
                  }
                  size={30}
                  color={Colors.dark.tint}
                />
                <View style={styles.workoutTextContainer}>
                  <ThemedText type="subtitle" style={styles.workoutCardTitle}>
                    {activeWorkout?.name ?? "Workout"}
                  </ThemedText>
                  <ThemedText style={styles.exerciseInfo}>
                    Workout in progress
                  </ThemedText>
                </View>
                <View style={styles.smallButtonGroup}>
                  <Button
                    mode="contained"
                    theme={{ colors: { primary: Colors.dark.tint } }}
                    onPress={() => router.push("/(app)/(workout)")}
                    labelStyle={styles.smallButtonLabel}
                  >
                    Resume
                  </Button>
                </View>
              </View>
            </Pressable>
          )}
          {activePlan && settings ? (
            <>
              {settings.showOnboarding === "true" && <Onboarding />}
              <ThemedText type="default" style={styles.sectionTitle}>
                Active Plan: {activePlan.name}
              </ThemedText>

              {workoutsToDisplay.map((workout, index) => {
                const target = perWorkoutTarget.get(workout.id!) ?? 0;

                // Filter to check how many times this specific workout has been completed this week
                const completedTimes =
                  completedWorkoutsThisPlanThisWeek?.filter(
                    (completedWorkout) =>
                      completedWorkout.workout_id === workout.id,
                  ).length;

                // Condition to check if the workout is completed enough times
                const workoutCompleted = completedTimes >= target;
                const originalIndex = activePlan.workouts.findIndex(
                  (w) => w.id === workout.id,
                );
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.workoutCard,
                      !workoutInProgress &&
                      index === 0 &&
                      !weeklyGoalReached &&
                      !isRestDay &&
                      completedTodayWorkoutIds.size === 0
                        ? {
                            borderWidth: 1,
                            borderColor: Colors.dark.tint,
                          }
                        : null,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/workout-details",
                        params: {
                          planId: String(activePlan.id),
                          workoutIndex: String(originalIndex),
                        },
                      })
                    }
                  >
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
                            !workoutInProgress &&
                            index === 0 &&
                            !weeklyGoalReached &&
                            !isRestDay &&
                            completedTodayWorkoutIds.size === 0
                              ? "contained"
                              : "outlined"
                          }
                          onPress={() => {
                            if (isStartingWorkout) return;
                            confirmStartWorkout(setIsStartingWorkout, () => {
                              useActiveWorkoutStore
                                .getState()
                                .setWorkout(
                                  JSON.parse(JSON.stringify(workout)),
                                  activePlan.id!,
                                  workout.id!,
                                  workout.name ||
                                    `Workout ${originalIndex + 1}`,
                                );
                            });
                          }}
                          labelStyle={styles.smallButtonLabel}
                          disabled={isStartingWorkout}
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
                        labelStyle={styles.smallButtonLabel}
                      >
                        View
                      </Button> */}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </>
          ) : (
            <Onboarding />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            textColor={Colors.dark.tint}
            onPress={() => {
              if (isStartingWorkout) return;
              confirmStartWorkout(setIsStartingWorkout, () => {
                useActiveWorkoutStore.getState().startQuickWorkout();
              });
            }}
            style={styles.startWorkoutButton}
            labelStyle={styles.buttonLabel}
          >
            Quick Workout
          </Button>
        </View>
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
  restDayContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
