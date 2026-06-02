import { useMemo, useState, useCallback, useContext } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { AppImage, AppIcon } from "@/components/ui";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { usePlanScheduleQuery } from "@/hooks/usePlanScheduleQuery";
import { useDeletePlanMutation } from "@/hooks/useDeletePlanMutation";
import { useSetActivePlanMutation } from "@/hooks/useSetActivePlanMutation";
import WeeklyScheduleDisplay from "@/components/WeeklyScheduleDisplay";
import {
  Snackbar,
  Button,
  IconButton,
  Portal,
  Modal,
  Switch,
  ActivityIndicator,
} from "react-native-paper";
import Bugsnag from "@bugsnag/expo";
import { Notes } from "@/components/Notes";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";
import type { Workout } from "@/store/workoutStore";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { useDeloadWeekQuery } from "@/hooks/useDeloadWeekQuery";
import { useDeloadWeekMutation } from "@/hooks/useDeloadWeekMutation";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { getCurrentISOWeek } from "@/utils/isoWeek";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { usePlanPublishQuery } from "@/hooks/usePlanPublishQuery";
import { usePlanPublishMutation } from "@/hooks/usePlanPublishMutation";

const fallbackImage = require("@/assets/images/placeholder.webp");

function PlanWorkoutCard({
  workout,
  index,
  planId,
  countUnilateralDouble,
}: {
  workout: Workout;
  index: number;
  planId: string | string[];
  countUnilateralDouble: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { estimate } = useWorkoutDurationEstimate(
    workout.exercises,
    countUnilateralDouble,
  );
  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/workout-details",
          params: {
            planId: String(planId),
            workoutIndex: String(index),
          },
        })
      }
      style={styles.workoutCard}
    >
      <ThemedText style={styles.workoutTitle}>
        {workout.name || `Day ${index + 1}`}
      </ThemedText>
      <ThemedText style={styles.workoutInfo}>
        <Trans>
          {workout.exercises.length} Exercises
          {estimate ? `  ·  ~${formatDurationEstimate(estimate)}` : ""}
        </Trans>
      </ThemedText>
    </TouchableOpacity>
  );
}

export default function PlanOverviewScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const { data: scheduleEntries = [] } = usePlanScheduleQuery(Number(planId));
  const { data: settings } = useSettingsQuery();
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const deletePlanMutation = useDeletePlanMutation();
  const setActivePlanMutation = useSetActivePlanMutation();
  const progressionSettings = useProgressionSettingsQuery();
  const { isCurrentWeekDeload } = useDeloadWeekQuery(
    Number(planId) || undefined,
  );
  const deloadMutation = useDeloadWeekMutation(Number(planId));

  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  const showShareToggle = !!user && !!privacySettings?.sharePlans;
  const { data: isPublished = false, isLoading: isPublishLoading } =
    usePlanPublishQuery(showShareToggle ? Number(planId) : null);
  const publishMutation = usePlanPublishMutation(Number(planId));

  const handleToggleDeload = useCallback(() => {
    deloadMutation.mutate(isCurrentWeekDeload ? null : getCurrentISOWeek());
  }, [isCurrentWeekDeload, deloadMutation]);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarError, setSnackbarError] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const imageSource = plan?.image_url ? { uri: plan.image_url } : fallbackImage;

  const handleDeletePlan = () => {
    Alert.alert(
      t`Delete Plan`,
      t`Are you sure you want to delete this plan?`,
      [
        {
          text: t`Cancel`,
          style: "cancel",
        },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: () => {
            deletePlanMutation.mutate(Number(planId), {
              onSuccess: () => {
                router.back(); // Navigate back after deletion
              },
              onError: (error) => {
                Alert.alert(
                  t`Error`,
                  t`Failed to delete plan: ${error.message}`,
                );
                Bugsnag.notify(error);
              },
            });
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleStartPlan = () => {
    setActivePlanMutation.mutate(Number(planId), {
      onSuccess: () => {
        setSnackbarMessage(t`You activated this plan.`);
        setSnackbarError(false);
        setSnackbarVisible(true);
      },
      onError: (error) => {
        setSnackbarMessage(t`Failed to activate this plan: ${error.message}`);
        setSnackbarError(true);
        setSnackbarVisible(true);
        Bugsnag.notify(error);
      },
    });
  };

  if (isLoading) {
    return (
      <ThemedText>
        <Trans>Loading...</Trans>
      </ThemedText>
    );
  }

  if (error) {
    return (
      <ThemedText>
        <Trans>Error: {error.message}</Trans>
      </ThemedText>
    );
  }

  return (
    <ThemedView>
      {isEditing && (
        <Portal>
          <Modal visible={isEditing} dismissable={false}>
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.contentPrimary} />
              <ThemedText style={styles.loadingText}>
                <Trans>Loading Plan...</Trans>
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      {!plan?.app_plan_id && (
        <Stack.Screen
          options={{
            headerRight: () => (
              <>
                <Notes
                  noteType="plan"
                  referenceId={Number(planId)}
                  buttonType="icon"
                />
                <IconButton
                  icon="trash-can-outline"
                  size={25}
                  style={{ marginRight: 0 }}
                  iconColor={colors.danger}
                  onPressIn={handleDeletePlan}
                />
              </>
            ),
          }}
        />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.planHeader}>
          <AppImage source={imageSource} style={styles.planImage} />
          <ThemedText style={styles.planName}>{plan?.name}</ThemedText>
          {plan?.is_active === 1 && (
            <View style={styles.activeBadge}>
              <ThemedText style={styles.activeBadgeText}>
                <Trans>Active</Trans>
              </ThemedText>
            </View>
          )}
        </View>

        {plan?.workouts.map((workout, index) => (
          <PlanWorkoutCard
            key={index.toString()}
            workout={workout}
            index={index}
            planId={planId}
            countUnilateralDouble={countUnilateralDouble}
          />
        ))}

        <WeeklyScheduleDisplay
          workouts={plan?.workouts ?? []}
          scheduleEntries={scheduleEntries}
        />

        {plan?.is_active === 1 && progressionSettings.enabled && (
          <TouchableOpacity
            onPress={handleToggleDeload}
            style={[styles.deloadRow]}
            activeOpacity={0.7}
          >
            <View style={styles.deloadLeft}>
              <AppIcon
                set="ion"
                name="calendar-clear-outline"
                size={20}
                color={
                  isCurrentWeekDeload ? colors.accent : colors.contentSecondary
                }
                style={{ marginRight: 10 }}
              />
              <ThemedText
                style={[
                  styles.deloadTitle,
                  isCurrentWeekDeload && { color: colors.accent },
                ]}
              >
                <Trans>Deload Week</Trans>
              </ThemedText>
            </View>
            <View pointerEvents="none">
              <Switch value={isCurrentWeekDeload} color={colors.accent} />
            </View>
          </TouchableOpacity>
        )}

        {showShareToggle && (
          <TouchableOpacity
            onPress={() => publishMutation.mutate(!isPublished)}
            style={[styles.deloadRow]}
            activeOpacity={0.7}
            disabled={publishMutation.isPending || isPublishLoading}
          >
            <View style={styles.deloadLeft}>
              <AppIcon
                set="mci"
                name="cloud-outline"
                size={20}
                color={isPublished ? colors.accent : colors.contentSecondary}
                style={{ marginRight: 10 }}
              />
              <ThemedText
                style={[
                  styles.deloadTitle,
                  isPublished && { color: colors.accent },
                ]}
              >
                <Trans>Share Plan</Trans>
              </ThemedText>
            </View>
            {publishMutation.isPending || isPublishLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <View pointerEvents="none">
                <Switch value={isPublished} color={colors.accent} />
              </View>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleStartPlan}
          style={styles.paperButton}
          labelStyle={styles.buttonLabel}
        >
          <Trans>Start Plan</Trans>
        </Button>
        <Button
          mode="outlined"
          onPress={async () => {
            if (isEditing) return; // Prevent multiple taps

            setIsEditing(true);

            try {
              await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay for UX
              router.push({
                pathname: "/(app)/(create-plan)/create",
                params: { planId },
              });
            } finally {
              setIsEditing(false);
            }
          }}
          style={styles.paperButton}
          labelStyle={styles.buttonLabel}
          disabled={isEditing}
        >
          {plan?.app_plan_id ? (
            <Trans>Customise Plan</Trans>
          ) : (
            <Trans>Edit Plan</Trans>
          )}
        </Button>
      </View>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={{
          backgroundColor: snackbarError ? colors.danger : colors.success,
        }}
        action={{
          label: t`DISMISS`,
          onPress: () => {
            setSnackbarVisible(false);
          },
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      paddingTop: 16,
      paddingBottom: 50,
      paddingHorizontal: 16,
    },
    planHeader: {
      alignItems: "center",
      marginBottom: 20,
    },
    planImage: {
      width: "100%",
      height: 200,
      borderRadius: radii.md,
    },
    planName: {
      fontSize: 24,
      lineHeight: 27,
      color: colors.contentPrimary,
      marginTop: 10,
    },
    workoutCard: {
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 10,
      borderRadius: radii.md,
    },
    workoutTitle: {
      fontSize: 18,
      color: colors.contentPrimary,
      fontWeight: "bold",
    },
    workoutInfo: {
      fontSize: 16,
      color: colors.contentPrimary,
    },
    buttonContainer: {
      flexDirection: "row",
      padding: 16,
      gap: 10,
      backgroundColor: colors.background,
    },
    paperButton: {
      flex: 1,
    },
    buttonLabel: {
      paddingVertical: 0,
    },
    deloadRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: "transparent",
      padding: 14,
      marginTop: 16,
    },
    deloadLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    deloadTitle: {
      fontSize: 15,
      fontWeight: "600",
    },
    deloadSubtitle: {
      fontSize: 12,
      color: colors.contentSecondary,
      marginTop: 2,
    },
    activeBadge: {
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
      position: "absolute",
      top: 10,
      right: 10,
    },
    activeBadgeText: {
      color: colors.contentPrimary,
      fontWeight: "bold",
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
  });
}
