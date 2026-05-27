import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { startOfWeek, endOfWeek, getDay, format } from "date-fns";
import { ActivityIndicator, Button, Portal, Modal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WeekDays from "@/components/WeekDays";
import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthProvider";
import { useActivePlanQuery } from "@/hooks/useActivePlanQuery";
import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimateCompact } from "@/utils/estimateWorkoutDuration";
import {
  CompletedWorkout,
  useCompletedWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { Workout, UserExercise } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import Onboarding from "@/components/Onboarding";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { UpdateModal } from "@/components/UpdateModal";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { usePlanScheduleQuery } from "@/hooks/usePlanScheduleQuery";
import RestDayCard from "@/components/RestDayCard";
import WorkoutDoneCard from "@/components/WorkoutDoneCard";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import {
  computeWeeklyTargets,
  prioritizeScheduledWorkout,
} from "@/utils/planHelpers";
import { useWeeklyStreak } from "@/hooks/useWeeklyStreak";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

function WorkoutDurationInfo({
  exercises,
  countUnilateralDouble,
  style,
}: {
  exercises: UserExercise[];
  countUnilateralDouble: boolean;
  style?: object;
}) {
  const { estimate } = useWorkoutDurationEstimate(
    exercises,
    countUnilateralDouble,
  );
  return (
    <ThemedText style={style}>
      <Trans>
        {exercises.length} Exercises
        {estimate ? `  ·  ~${formatDurationEstimateCompact(estimate)}` : ""}
      </Trans>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [pickerWorkouts, setPickerWorkouts] = useState<CompletedWorkout[]>([]);
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
  const distanceUnit = settings?.distanceUnit || "m";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const {
    data: completedWorkouts,
    isLoading: completedWorkoutsLoading,
    error: completedWorkoutsError,
  } = useCompletedWorkoutsQuery(weightUnit, distanceUnit);

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

  const { streak } = useWeeklyStreak(
    completedWorkouts,
    Number(settings?.weeklyGoal ?? 0),
    uniqueWorkoutDaysCount,
    weeklyGoalReached,
  );

  if (
    activePlanLoading ||
    settingsLoading ||
    completedWorkoutsLoading ||
    (!!activePlan && planScheduleLoading)
  ) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  } else if (activePlanError || settingsError || completedWorkoutsError) {
    const error = activePlanError || settingsError || completedWorkoutsError;

    if (error) {
      Bugsnag.notify(error);
    }
    return (
      <ThemedText style={styles.loadingContainer}>
        <Trans>
          Error fetching{" "}
          {activePlanError
            ? t`active plan`
            : settingsError
              ? t`settings`
              : t`completed workouts`}
          : {error?.message}
        </Trans>
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
      const target = perWorkoutTarget.get(workout.id!);
      const completedTimes = completedWorkoutCounts.get(workout.id!) || 0;
      const workoutCompleted = target !== undefined && completedTimes >= target;

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

  const navigateToWorkoutSummary = (id: number) =>
    router.push({
      pathname: "/(app)/(workout)/workout-summary",
      params: { completedWorkoutId: String(id) },
    });

  const handleDayPress = (workouts: CompletedWorkout[]) => {
    if (workouts.length === 1) {
      navigateToWorkoutSummary(workouts[0].id);
    } else {
      setPickerWorkouts(workouts);
    }
  };

  const handleWorkoutDoneCardPress = () => {
    const todayStr = today.toDateString();
    const todayWorkouts =
      completedWorkoutsThisWeek?.filter(
        (w) => new Date(w.date_completed).toDateString() === todayStr,
      ) ?? [];
    if (todayWorkouts.length === 1) {
      navigateToWorkoutSummary(todayWorkouts[0].id);
    } else if (todayWorkouts.length > 1) {
      setPickerWorkouts(todayWorkouts);
    }
  };

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
                <Trans>Starting Workout...</Trans>
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      {pickerWorkouts.length > 0 && (
        <Portal>
          <Modal
            visible={pickerWorkouts.length > 0}
            onDismiss={() => setPickerWorkouts([])}
            contentContainerStyle={styles.pickerModal}
            theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
          >
            <ThemedText type="subtitle" style={styles.pickerTitle}>
              <Trans>Select a workout to view</Trans>
            </ThemedText>
            {pickerWorkouts.map((workout) => (
              <Pressable
                key={workout.id}
                style={styles.pickerItem}
                onPress={() => {
                  setPickerWorkouts([]);
                  navigateToWorkoutSummary(workout.id);
                }}
              >
                <ThemedText style={styles.pickerItemName}>
                  {workout.workout_name}
                </ThemedText>
                <ThemedText style={styles.pickerItemTime}>
                  {format(new Date(workout.date_completed), "h:mm a")}
                </ThemedText>
              </Pressable>
            ))}
          </Modal>
        </Portal>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.weekContainer}>
          <WeekDays
            completedWorkoutsThisWeek={completedWorkoutsThisWeek}
            onDayPress={handleDayPress}
          />
        </View>
        <View style={styles.summaryContainer}>
          <ThemedText style={styles.summaryText}>
            <Trans>
              {uniqueWorkoutDaysCount} / {settings?.weeklyGoal} days worked out
            </Trans>
          </ThemedText>
        </View>
        <View style={styles.welcomeContainer}>
          <ThemedText type="subtitle">
            {activePlan ? (
              <Trans>Welcome back{userName}</Trans>
            ) : (
              <Trans>Welcome{userName}</Trans>
            )}
          </ThemedText>
          <ThemedText type="default">
            {!activePlan ? (
              <Trans>Your journey to Swoletown begins today!</Trans>
            ) : (
              <Trans>Make sure to track your progress!</Trans>
            )}
          </ThemedText>
        </View>

        {weeklyGoalReached && (
          <View style={styles.restDayContainer}>
            <WeeklySummaryCard
              workoutsThisWeek={completedWorkoutsThisWeek ?? []}
              allCompletedWorkouts={completedWorkouts ?? []}
              weeklyGoal={Number(settings?.weeklyGoal)}
              weightUnit={settings?.weightUnit ?? "kg"}
              streak={streak}
              excludeWarmup={settings?.excludeWarmupSets === "true"}
              countUnilateralDouble={settings?.countUnilateralDouble === "true"}
              doubleWeightForPaired={settings?.doubleWeightForPaired === "true"}
            />
          </View>
        )}

        {!weeklyGoalReached &&
          isRestDay &&
          planScheduleEntries &&
          activePlan &&
          !showResumeCard && (
            <View style={styles.restDayContainer}>
              <RestDayCard
                schedule={planScheduleEntries}
                workouts={activePlan.workouts}
                todayDow={todayDow}
              />
            </View>
          )}

        {!weeklyGoalReached && showWorkoutDoneCard && (
          <View style={styles.restDayContainer}>
            <WorkoutDoneCard
              schedule={planScheduleEntries!}
              workouts={activePlan!.workouts}
              todayDow={todayDow}
              onPress={handleWorkoutDoneCardPress}
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
                  borderColor: colors.accent,
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
                  color={colors.accent}
                />
                <View style={styles.workoutTextContainer}>
                  <ThemedText type="subtitle" style={styles.workoutCardTitle}>
                    {activeWorkout?.name ?? "Workout"}
                  </ThemedText>
                  <ThemedText style={styles.exerciseInfo}>
                    <Trans>Workout in progress</Trans>
                  </ThemedText>
                </View>
                <View style={styles.smallButtonGroup}>
                  <Button
                    mode="contained"
                    theme={{ colors: { primary: colors.accent } }}
                    onPress={() => router.push("/(app)/(workout)")}
                    labelStyle={styles.smallButtonLabel}
                  >
                    <Trans>Resume</Trans>
                  </Button>
                </View>
              </View>
            </Pressable>
          )}
          {activePlan && settings ? (
            <>
              {settings.showOnboarding === "true" && <Onboarding />}
              <ThemedText type="default" style={styles.sectionTitle}>
                <Trans>Active Plan: {activePlan.name}</Trans>
              </ThemedText>

              {workoutsToDisplay.map((workout, index) => {
                const target = perWorkoutTarget.get(workout.id!);

                // Filter to check how many times this specific workout has been completed this week
                const completedTimes =
                  completedWorkoutsThisPlanThisWeek?.filter(
                    (completedWorkout) =>
                      completedWorkout.workout_id === workout.id,
                  ).length ?? 0;

                // Condition to check if the workout is completed enough times
                const workoutCompleted =
                  target !== undefined && completedTimes >= target;
                const originalIndex = activePlan.workouts.findIndex(
                  (w) => w.id === workout.id,
                );
                const shouldHighlightCard =
                  !workoutInProgress &&
                  index === 0 &&
                  !weeklyGoalReached &&
                  !isRestDay &&
                  completedTodayWorkoutIds.size === 0;
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.workoutCard,
                      shouldHighlightCard
                        ? {
                            borderWidth: 1,
                            borderColor: colors.accent,
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
                            ? colors.success
                            : colors.contentSecondary
                        }
                      />
                      <View style={styles.workoutTextContainer}>
                        <ThemedText
                          type="subtitle"
                          style={styles.workoutCardTitle}
                        >
                          {workout.name}
                        </ThemedText>
                        <WorkoutDurationInfo
                          exercises={workout.exercises}
                          countUnilateralDouble={countUnilateralDouble}
                          style={styles.exerciseInfo}
                        />
                      </View>
                      <View style={styles.smallButtonGroup}>
                        <Button
                          mode={shouldHighlightCard ? "contained" : "outlined"}
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
                          <Trans>Start</Trans>
                        </Button>
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
            textColor={colors.accent}
            onPress={() => {
              if (isStartingWorkout) return;
              confirmStartWorkout(setIsStartingWorkout, () => {
                useActiveWorkoutStore.getState().startQuickWorkout();
              });
            }}
            style={styles.startWorkoutButton}
            labelStyle={styles.buttonLabel}
          >
            <Trans>Quick Workout</Trans>
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
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
      backgroundColor: colors.background,
    },
    summaryContainer: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.background,
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
      borderRadius: radii.md,
      backgroundColor: colors.card,
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
      color: colors.contentPrimary,
      fontSize: 16,
      fontWeight: "bold",
    },
    exerciseInfo: {
      color: colors.contentSecondary,
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
      borderRadius: radii.xl,
      width: "100%",
      height: 50,
    },
    buttonLabel: {
      fontSize: 18,
      lineHeight: 27,
    },
    pickerModal: {
      backgroundColor: colors.card,
      margin: 24,
      borderRadius: radii.lg,
      padding: 20,
    },
    pickerTitle: {
      marginBottom: 12,
    },
    pickerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.background,
    },
    pickerItemName: {
      fontSize: 16,
      flex: 1,
    },
    pickerItemTime: {
      fontSize: 14,
      color: colors.contentSecondary,
      marginLeft: 8,
    },
  });
}
