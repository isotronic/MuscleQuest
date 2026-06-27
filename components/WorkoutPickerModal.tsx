import { useMemo, useState } from "react";
import { View, TextInput, ScrollView, StyleSheet } from "react-native";
import { Portal, Modal, ActivityIndicator } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import StandaloneWorkoutListItem from "@/components/StandaloneWorkoutListItem";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { buildWorkoutPickerSections } from "@/utils/workoutPicker";
import { Workout } from "@/store/workoutStore";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

interface WorkoutPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  setIsStartingWorkout: (value: boolean) => void;
}

export default function WorkoutPickerModal({
  visible,
  onDismiss,
  setIsStartingWorkout,
}: WorkoutPickerModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: plansData, isLoading: plansLoading } = useAllPlansQuery();
  const { data: standaloneWorkouts, isLoading: standaloneLoading } =
    useStandaloneWorkoutsQuery();
  const { data: settings } = useSettingsQuery();
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";

  const isLoading = plansLoading || standaloneLoading;

  const { planSections, standaloneWorkouts: filteredStandalone } = useMemo(
    () =>
      buildWorkoutPickerSections(
        plansData?.userPlans ?? [],
        standaloneWorkouts ?? [],
        searchQuery,
      ),
    [plansData?.userPlans, standaloneWorkouts, searchQuery],
  );

  const hasAnyWorkouts =
    (plansData?.userPlans.some((plan) => plan.workouts.length > 0) ?? false) ||
    (standaloneWorkouts?.length ?? 0) > 0;
  const hasResults = planSections.length > 0 || filteredStandalone.length > 0;

  const handleStartPlanWorkout = (planId: number | null, workout: Workout) => {
    confirmStartWorkout(setIsStartingWorkout, () => {
      onDismiss();
      useActiveWorkoutStore
        .getState()
        .setWorkout(workout, planId, workout.id ?? null, workout.name);
    });
  };

  const handleStartStandaloneWorkout = (workout: Workout) => {
    confirmStartWorkout(setIsStartingWorkout, () => {
      onDismiss();
      useActiveWorkoutStore
        .getState()
        .setWorkout(workout, null, workout.id ?? null, workout.name);
    });
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
        theme={{ colors: { backdrop: colors.modalBackdrop } }}
      >
        <ThemedText style={styles.title}>
          <Trans>Choose a Workout</Trans>
        </ThemedText>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholderTextColor={colors.contentSecondary}
            placeholder={t`Search`}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.contentPrimary}
            style={styles.loadingIndicator}
          />
        ) : (
          <ScrollView style={styles.list}>
            {!hasAnyWorkouts ? (
              <ThemedText style={styles.emptyText}>
                <Trans>No workouts yet</Trans>
              </ThemedText>
            ) : !hasResults ? (
              <ThemedText style={styles.emptyText}>
                <Trans>No workouts found</Trans>
              </ThemedText>
            ) : (
              <>
                {planSections.map((section) => (
                  <View
                    key={section.planId ?? "no-plan"}
                    style={styles.section}
                  >
                    <ThemedText style={styles.sectionTitle}>
                      {section.planName}
                    </ThemedText>
                    {section.workouts.map((workout) => (
                      <StandaloneWorkoutListItem
                        key={`plan-${section.planId}-${workout.id}`}
                        workout={workout}
                        onPress={() =>
                          handleStartPlanWorkout(section.planId, workout)
                        }
                        countUnilateralDouble={countUnilateralDouble}
                      />
                    ))}
                  </View>
                ))}
                {filteredStandalone.length > 0 && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>
                      <Trans>Standalone Workouts</Trans>
                    </ThemedText>
                    {filteredStandalone.map((workout) => (
                      <StandaloneWorkoutListItem
                        key={`standalone-${workout.id}`}
                        workout={workout}
                        onPress={() => handleStartStandaloneWorkout(workout)}
                        countUnilateralDouble={countUnilateralDouble}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    modal: {
      backgroundColor: colors.card,
      margin: 20,
      marginTop: 80,
      marginBottom: 60,
      borderRadius: radii.lg,
      padding: 20,
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderColor: colors.contentPrimary,
      borderWidth: 1,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      color: colors.contentPrimary,
    },
    list: {
      flex: 1,
    },
    loadingIndicator: {
      marginTop: 40,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.contentSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    emptyText: {
      textAlign: "center",
      color: colors.contentSecondary,
      marginTop: 40,
    },
  });
}
