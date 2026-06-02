import { useMemo, useState } from "react";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";
import { useQueryClient } from "@tanstack/react-query";
import { useAllPlansQuery, Plan } from "@/hooks/useAllPlansQuery";
import { PlanList, PlanViewMode } from "@/components/PlanList";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import StandaloneWorkoutListItem from "@/components/StandaloneWorkoutListItem";
import { Workout } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { updateSettings } from "@/utils/database";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { usePublishedPlanIdsQuery } from "@/hooks/usePublishedPlanIdsQuery";
import { useSocialStore } from "@/store/socialStore";

export default function PlansScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { data: plans, isLoading, isError, error } = useAllPlansQuery();
  const { data: settings } = useSettingsQuery();
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const [viewMode, setViewMode] = useState<PlanViewMode>(
    (settings?.plansViewMode as PlanViewMode) ?? "carousel",
  );
  const {
    data: standaloneWorkouts,
    isLoading: standaloneIsLoading,
    isError: standaloneIsError,
    error: standaloneError,
  } = useStandaloneWorkoutsQuery();
  const { data: publishedPlanIds } = usePublishedPlanIdsQuery();
  const { privacySettings } = useSocialStore();

  useEffect(() => {
    if (standaloneIsError && standaloneError) {
      Bugsnag.notify(standaloneError as Error);
    }
  }, [standaloneIsError, standaloneError]);

  useEffect(() => {
    if (settings?.plansViewMode) {
      setViewMode(settings.plansViewMode as PlanViewMode);
    }
  }, [settings?.plansViewMode]);

  const handleViewModeChange = async (mode: PlanViewMode) => {
    const prev = viewMode;
    setViewMode(mode);
    try {
      await updateSettings("plansViewMode", mode);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      setViewMode(prev);
    }
  };

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
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (isError) {
    Bugsnag.notify(error);
    return (
      <ThemedText>
        <Trans>Error loading plans</Trans>
      </ThemedText>
    );
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
                <Trans>New Workout</Trans>
              </Button>
              <Button
                mode="contained"
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                onPress={handleCreatePlan}
              >
                <Trans>New Plan</Trans>
              </Button>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <PlanList
          title={t`Your training plans`}
          data={plans?.userPlans}
          onPressItem={handleViewPlan}
          viewMode={viewMode}
          showViewToggle
          onViewModeChange={handleViewModeChange}
          publishedPlanIds={publishedPlanIds}
          sharePlansEnabled={!!privacySettings?.sharePlans}
        />
        <PlanList
          title={t`Premade plans`}
          data={plans?.appPlans}
          onPressItem={handleViewPlan}
          viewMode={viewMode}
        />
        <View style={styles.workoutsSection}>
          <ThemedText style={styles.sectionTitle}>
            <Trans>Your workouts</Trans>
          </ThemedText>
          {standaloneIsLoading ? (
            <ActivityIndicator size="small" color={colors.contentPrimary} />
          ) : standaloneIsError ? (
            <ThemedText style={styles.emptyText}>
              <Trans>Failed to load workouts</Trans>
            </ThemedText>
          ) : standaloneWorkouts && standaloneWorkouts.length > 0 ? (
            standaloneWorkouts.map((item) => (
              <StandaloneWorkoutListItem
                key={item.id!.toString()}
                workout={item}
                onPress={() => handleViewWorkout(item)}
                countUnilateralDouble={countUnilateralDouble}
              />
            ))
          ) : (
            <ThemedText style={styles.emptyText}>
              <Trans>No workouts yet</Trans>
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
      color: colors.contentSecondary,
      fontSize: 14,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
      color: colors.contentPrimary,
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
}
