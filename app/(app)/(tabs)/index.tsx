import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { getDay, format } from "date-fns";
import {
  isLocalDateInRange,
  parseDbTimestamp,
  toLocalDateKey,
} from "@/utils/dates";
import { ActivityIndicator, Button, Portal, Modal } from "react-native-paper";
import { AppIcon } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import WeekDays from "@/components/WeekDays";
import { useEffect, useMemo, useState } from "react";
import { useActivePlanQuery } from "@/hooks/useActivePlanQuery";
import { router } from "expo-router";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import { showSnackbar } from "@/store/snackbarStore";
import { useWeekRule } from "@/hooks/useWeekRule";
import { endOfAppWeek, startOfAppWeek } from "@/utils/week";
import {
  CompletedWorkout,
  RECENT_HISTORY_DAYS,
  useCompletedWorkoutsQuery,
} from "@/hooks/useCompletedWorkoutsQuery";
import { useHasCompletedWorkoutQuery } from "@/hooks/useWorkoutSummariesQuery";
import { Workout } from "@/store/workoutStore";
import Onboarding, { shouldShowActivationCard } from "@/components/Onboarding";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { UpdateModal } from "@/components/UpdateModal";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { resumeActiveWorkout } from "@/utils/resumeWorkout";
import { usePlanScheduleQuery } from "@/hooks/usePlanScheduleQuery";
import { useLastPlanWorkoutQuery } from "@/hooks/useLastPlanWorkoutQuery";
import { BackupReminderCard } from "@/components/BackupReminderCard";
import { SetupOfferCard } from "@/components/SetupOfferCard";
import { SetupState } from "@/utils/setupState";
import WorkoutDoneCard from "@/components/WorkoutDoneCard";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import WorkoutPickerModal from "@/components/WorkoutPickerModal";
import { MeasurementQuickLog } from "@/components/MeasurementQuickLog";
import { planWorkoutsForWeek } from "@/utils/planHelpers";
import { useWeeklyStreak } from "@/hooks/useWeeklyStreak";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { displayWorkoutName } from "@/utils/workoutName";
import TodayCard from "@/components/home/TodayCard";
import { WorkoutDurationInfo } from "@/components/home/WorkoutDurationInfo";
import { todayHero } from "@/utils/homeToday";
import { useHomeUiStore } from "@/store/homeUiStore";

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const startQuickWorkout = () => {
    if (isStartingWorkout) return;
    confirmStartWorkout(setIsStartingWorkout, () => {
      useActiveWorkoutStore.getState().startQuickWorkout();
    });
  };
  const { mutate: updateSetting } = useUpdateSettingsMutation();
  const hideTips = () => {
    updateSetting({ key: "showOnboarding", value: "false" });
    showSnackbar(t`Tips hidden. Turn them back on in Settings.`);
  };
  const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);
  const [pickerWorkouts, setPickerWorkouts] = useState<CompletedWorkout[]>([]);

  const {
    data: activePlan,
    isLoading: activePlanLoading,
    error: activePlanError,
    refetch: refetchActivePlan,
  } = useActivePlanQuery();
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const {
    data: completedWorkouts,
    isLoading: completedWorkoutsLoading,
    error: completedWorkoutsError,
    refetch: refetchCompletedWorkouts,
  } = useCompletedWorkoutsQuery(weightUnit, distanceUnit, RECENT_HISTORY_DAYS);
  const { data: hasCompletedWorkout } = useHasCompletedWorkoutQuery();

  const { data: planScheduleEntries, isLoading: planScheduleLoading } =
    usePlanScheduleQuery(activePlan?.id ?? null);
  const {
    data: lastPlanWorkoutId,
    isLoading: lastPlanWorkoutLoading,
    error: lastPlanWorkoutError,
    refetch: refetchLastPlanWorkout,
  } = useLastPlanWorkoutQuery(activePlan?.id ?? null);

  const activeWorkout = useActiveWorkoutStore((state) => state.activeWorkout);
  const workoutInProgress = useActiveWorkoutStore((state) =>
    Boolean(state.activeWorkout && state.workout),
  );
  const [showResumeCard, setShowResumeCard] = useState(workoutInProgress);
  const otherWorkoutsOpen = useHomeUiStore((s) => s.otherWorkoutsOpen);
  const toggleOtherWorkouts = useHomeUiStore((s) => s.toggleOtherWorkouts);

  useEffect(() => {
    if (!workoutInProgress) {
      setShowResumeCard(false);
      return;
    }
    const timer = setTimeout(() => setShowResumeCard(true), 1000);
    return () => clearTimeout(timer);
  }, [workoutInProgress]);

  const weekRule = useWeekRule();
  const today = new Date();
  // day_of_week: 0=Mon … 6=Sun  (JS Sunday=0, so shift by +6 mod 7)
  const todayDow = (getDay(today) + 6) % 7;
  const startOfWeekDate = startOfAppWeek(today, weekRule);
  const endOfWeekDate = endOfAppWeek(today, weekRule);

  const todayKey = toLocalDateKey(today);

  // Filter workouts completed this week. local_date is the training day the
  // workout was logged on, so this does not shift with the device offset.
  const completedWorkoutsThisWeek = completedWorkouts?.filter((workout) =>
    isLocalDateInRange(workout.local_date, startOfWeekDate, endOfWeekDate),
  );

  const completedAnyWorkoutToday = (completedWorkoutsThisWeek ?? []).some(
    (w) => w.local_date === todayKey,
  );

  // Create a Set to track unique workout dates
  const uniqueWorkoutDays = new Set(
    completedWorkoutsThisWeek?.map((workout) => workout.local_date),
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
    weekRule,
  );

  const progressionSettings = useProgressionSettingsQuery();
  const { isCurrentWeekDeload } = useDeloadWeekQuery(
    activePlan?.id ?? undefined,
  );

  if (
    activePlanLoading ||
    settingsLoading ||
    completedWorkoutsLoading ||
    (!!activePlan && (planScheduleLoading || lastPlanWorkoutLoading))
  ) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  } else if (
    activePlanError ||
    settingsError ||
    completedWorkoutsError ||
    (!!activePlan && lastPlanWorkoutError)
  ) {
    // The global query cache handler reports the failure.
    return (
      <ErrorState
        showHome={false}
        onRetry={() => {
          if (activePlanError) void refetchActivePlan();
          if (settingsError) void refetchSettings();
          if (completedWorkoutsError) void refetchCompletedWorkouts();
          if (lastPlanWorkoutError) void refetchLastPlanWorkout();
        }}
      />
    );
  }

  let workoutsToDisplay: Workout[] = [];
  let isRestDay = false;
  // Workouts done for this week: target met with a schedule, logged at least
  // once without one.
  let doneThisWeekIds = new Set<number>();

  if (activePlan) {
    const planWeek = planWorkoutsForWeek({
      workouts: activePlan.workouts,
      schedule: planScheduleEntries,
      todayDow,
      todayKey,
      sessionsThisWeek:
        completedWorkoutsThisWeek?.filter(
          (workout) => String(workout.plan_id) === String(activePlan.id),
        ) ?? [],
      lastWorkoutId: lastPlanWorkoutId,
    });
    workoutsToDisplay = planWeek.workouts;
    doneThisWeekIds = planWeek.doneIds;
    isRestDay = planWeek.isRestDay;
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

  const todayWorkouts =
    completedWorkoutsThisWeek?.filter((w) => w.local_date === todayKey) ?? [];

  const handleWorkoutDoneCardPress = () => {
    if (todayWorkouts.length === 1) {
      navigateToWorkoutSummary(todayWorkouts[0].id);
    } else if (todayWorkouts.length > 1) {
      setPickerWorkouts(todayWorkouts);
    }
  };

  const todayScheduledEntry = planScheduleEntries?.find(
    (e) => e.day_of_week === todayDow,
  );
  const isScheduled = !!planScheduleEntries?.length;
  // Unscheduled plans have no rest days, so done today always shows the card.
  const showWorkoutDoneCard =
    !isRestDay &&
    !!activePlan &&
    (!isScheduled || !!todayScheduledEntry) &&
    completedAnyWorkoutToday;
  // Only show a specific workout's name when exactly one was completed today —
  // with multiple, WorkoutDoneCard falls back to a generic title.
  const completedWorkoutName =
    todayWorkouts.length === 1
      ? displayWorkoutName(todayWorkouts[0].workout_name)
      : null;

  const hero = todayHero({
    planId: activePlan?.id,
    planWorkouts: activePlan?.workouts ?? [],
    orderedWorkouts: workoutsToDisplay,
    schedule: planScheduleEntries,
    isRestDay,
    doneToday: showWorkoutDoneCard,
    todayDow,
    todayKey,
    recentSessions: completedWorkouts ?? [],
  });
  const heroWorkoutId = hero.kind === "workout" ? hero.workout.id : undefined;
  const otherWorkouts = workoutsToDisplay.filter(
    (w) => heroWorkoutId == null || w.id !== heroWorkoutId,
  );
  const showActivationCard = shouldShowActivationCard(
    !!activePlan,
    hasCompletedWorkout,
  );

  const startPlanWorkout = (workout: Workout, originalIndex: number) => {
    if (isStartingWorkout || !activePlan) return;
    confirmStartWorkout(setIsStartingWorkout, () => {
      useActiveWorkoutStore
        .getState()
        .setWorkout(
          JSON.parse(JSON.stringify(workout)),
          activePlan.id!,
          workout.id!,
          workout.name || `Workout ${originalIndex + 1}`,
        );
    });
  };

  const openPlanWorkout = (originalIndex: number) => {
    if (!activePlan) return;
    router.push({
      pathname: "/workout-details",
      params: {
        planId: String(activePlan.id),
        workoutIndex: String(originalIndex),
      },
    });
  };

  return (
    <ThemedView>
      <WhatsNewModal />
      <UpdateModal />
      {isStartingWorkout && (
        <Portal>
          <Modal visible={isStartingWorkout} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.contentPrimary} />
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
            theme={{ colors: { backdrop: colors.modalBackdrop } }}
          >
            <ThemedText type="subtitle" style={styles.pickerTitle}>
              <Trans>Select a workout to view</Trans>
            </ThemedText>
            {pickerWorkouts.map((workout) => (
              <Pressable
                accessibilityRole="button"
                key={workout.id}
                style={styles.pickerItem}
                onPress={() => {
                  setPickerWorkouts([]);
                  navigateToWorkoutSummary(workout.id);
                }}
              >
                <ThemedText style={styles.pickerItemName}>
                  {displayWorkoutName(workout.workout_name)}
                </ThemedText>
                <ThemedText style={styles.pickerItemTime}>
                  {format(parseDbTimestamp(workout.date_completed), "h:mm a")}
                </ThemedText>
              </Pressable>
            ))}
          </Modal>
        </Portal>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={styles.weekContainer}>
          <WeekDays
            completedWorkoutsThisWeek={completedWorkoutsThisWeek}
            onDayPress={handleDayPress}
            weekRule={weekRule}
            scheduledDayIndices={
              planScheduleEntries?.length
                ? new Set(planScheduleEntries.map((e) => e.day_of_week))
                : undefined
            }
          />
          <ThemedText style={styles.weekCaption}>
            <Trans>
              {uniqueWorkoutDaysCount} of {settings?.weeklyGoal} this week
            </Trans>
          </ThemedText>
        </View>

        <View style={styles.section}>
          {showResumeCard && (
            <Pressable
              accessibilityRole="button"
              style={[styles.workoutCard, styles.resumeCard]}
              testID="home-resume-workout"
              onPress={resumeActiveWorkout}
            >
              <View style={styles.workoutCardContent}>
                <AppIcon
                  set="mci"
                  name={
                    activeWorkout?.planId != null ? "weight-lifter" : "arm-flex"
                  }
                  size={30}
                  color={colors.accent}
                />
                <View style={styles.workoutTextContainer}>
                  <ThemedText type="subtitle" style={styles.workoutCardTitle}>
                    {displayWorkoutName(activeWorkout?.name)}
                  </ThemedText>
                  <ThemedText style={styles.exerciseInfo}>
                    <Trans>Workout in progress</Trans>
                  </ThemedText>
                </View>
                <View style={styles.smallButtonGroup}>
                  <Button
                    mode="contained"
                    theme={{ colors: { primary: colors.accent } }}
                    onPress={resumeActiveWorkout}
                    // Same action as the card, which screen readers announce.
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                    labelStyle={styles.smallButtonLabel}
                  >
                    <Trans>Resume</Trans>
                  </Button>
                </View>
              </View>
            </Pressable>
          )}

          {/* The in-progress session is the only action while it runs. */}
          {!workoutInProgress &&
            (hero.kind === "done" ? (
              <WorkoutDoneCard
                schedule={isScheduled ? planScheduleEntries! : null}
                workouts={activePlan!.workouts}
                rotationNext={workoutsToDisplay[0]}
                todayDow={todayDow}
                completedWorkoutName={completedWorkoutName}
                onPress={handleWorkoutDoneCardPress}
              />
            ) : hero.kind === "noPlan" && showActivationCard ? (
              <Onboarding showActivationCard showTips={false} />
            ) : (
              <TodayCard
                hero={hero}
                planName={activePlan?.name}
                isDeload={progressionSettings.enabled && isCurrentWeekDeload}
                countUnilateralDouble={countUnilateralDouble}
                disabled={isStartingWorkout}
                onStart={startPlanWorkout}
                onOpen={openPlanWorkout}
                onBrowsePlans={() => router.push("/(app)/(tabs)/(plans)")}
                onEditPlan={() =>
                  router.push({
                    pathname: "/(app)/(create-plan)/create",
                    params: { planId: String(activePlan?.id) },
                  })
                }
              />
            ))}

          <View style={styles.quickRow}>
            <Button
              mode="outlined"
              icon="lightning-bolt"
              textColor={colors.accent}
              testID="home-quick-workout"
              onPress={startQuickWorkout}
              style={styles.quickButton}
              contentStyle={styles.quickButtonContent}
            >
              <Trans>Quick workout</Trans>
            </Button>
            <Button
              mode="outlined"
              icon="format-list-bulleted"
              textColor={colors.accent}
              onPress={() => setShowWorkoutPicker(true)}
              style={styles.quickButton}
              contentStyle={styles.quickButtonContent}
            >
              <Trans>Choose workout</Trans>
            </Button>
          </View>

          {activePlan && otherWorkouts.length > 0 && (
            <View style={styles.otherSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: otherWorkoutsOpen }}
                testID="home-plan-workouts-toggle"
                onPress={toggleOtherWorkouts}
                style={styles.otherHeader}
              >
                <ThemedText
                  accessibilityRole="header"
                  style={styles.otherHeaderText}
                >
                  {heroWorkoutId != null ? (
                    <Trans>Other workouts in this plan</Trans>
                  ) : (
                    <Trans>Workouts in this plan</Trans>
                  )}
                </ThemedText>
                <AppIcon
                  set="mci"
                  name={otherWorkoutsOpen ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={colors.contentSecondary}
                />
              </Pressable>
              {otherWorkoutsOpen && (
                <View style={styles.workoutList}>
                  {otherWorkouts.map((workout) => {
                    const workoutCompleted = doneThisWeekIds.has(workout.id!);
                    const originalIndex = activePlan.workouts.findIndex(
                      (w) => w.id === workout.id,
                    );
                    const spokenName =
                      workout.name || t`Workout ${originalIndex + 1}`;
                    return (
                      <View key={workout.id} style={styles.workoutCard}>
                        <View style={styles.workoutCardContent}>
                          {/* Details and Start are siblings so a screen
                              reader can reach both; nested, Start would be
                              merged into the card and never activated. */}
                          <Pressable
                            accessibilityRole="button"
                            style={styles.workoutCardMain}
                            onPress={() => openPlanWorkout(originalIndex)}
                          >
                            <AppIcon
                              set="mci"
                              name={
                                workoutCompleted ? "check" : "weight-lifter"
                              }
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
                              {workoutCompleted && (
                                <ThemedText style={styles.doneThisWeek}>
                                  <Trans>Done this week</Trans>
                                </ThemedText>
                              )}
                            </View>
                          </Pressable>
                          <View style={styles.smallButtonGroup}>
                            <Button
                              mode="outlined"
                              onPress={() =>
                                startPlanWorkout(workout, originalIndex)
                              }
                              labelStyle={styles.smallButtonLabel}
                              disabled={isStartingWorkout}
                              accessibilityLabel={t`Start ${spokenName}`}
                              testID={`home-plan-workout-start-${originalIndex}`}
                            >
                              <Trans>Start</Trans>
                            </Button>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {weeklyGoalReached && (
            <WeeklySummaryCard
              workoutsThisWeek={completedWorkoutsThisWeek ?? []}
              allCompletedWorkouts={completedWorkouts ?? []}
              weeklyGoal={Number(settings?.weeklyGoal)}
              weightUnit={settings?.weightUnit ?? "kg"}
              streak={streak}
              excludeWarmup={settings?.excludeWarmupSets === "true"}
              countUnilateralDouble={settings?.countUnilateralDouble === "true"}
              doubleWeightForPaired={settings?.doubleWeightForPaired === "true"}
              includeBodyWeight={settings?.includeBodyWeightInVolume === "true"}
              weekRule={weekRule}
            />
          )}

          {/* One nudge at a time, the setup offer first. */}
          {!workoutInProgress &&
            (settings?.setupDone === SetupState.offered ? (
              <SetupOfferCard />
            ) : (
              <BackupReminderCard />
            ))}

          {settings?.showOnboarding === "true" && (
            <Onboarding onHideTips={hideTips} />
          )}

          <MeasurementQuickLog />
        </View>
      </ScrollView>
      {showWorkoutPicker && (
        <WorkoutPickerModal
          visible={showWorkoutPicker}
          onDismiss={() => setShowWorkoutPicker(false)}
          setIsStartingWorkout={setIsStartingWorkout}
        />
      )}
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
      backgroundColor: colors.modalBackdrop,
      position: "absolute",
      width: "100%",
      height: "100%",
    },
    loadingText: {
      marginTop: 10,
      fontSize: 18,
      color: colors.contentPrimary,
    },
    weekContainer: {
      flexDirection: "column",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    weekCaption: {
      alignSelf: "flex-end",
      paddingHorizontal: 16,
      paddingBottom: 4,
      fontSize: 14,
      color: colors.contentSecondary,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    resumeCard: {
      borderWidth: 1,
      borderColor: colors.accent,
      marginBottom: 16,
    },
    quickRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    quickButton: {
      flex: 1,
      borderRadius: radii.md,
    },
    quickButtonContent: {
      minHeight: 44,
    },
    otherSection: {
      marginBottom: 16,
    },
    otherHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    },
    otherHeaderText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
    },
    workoutList: {
      gap: 8,
    },
    workoutCard: {
      borderRadius: radii.md,
      backgroundColor: colors.card,
      padding: 16,
    },
    workoutCardContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    workoutCardMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
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
    doneThisWeek: {
      color: colors.success,
      fontSize: 13,
    },
    smallButtonGroup: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    smallButtonLabel: {
      paddingVertical: 0,
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
