import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Colors } from "@/constants/Colors";
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
  ActivityIndicator,
} from "react-native-paper";
import { useState } from "react";
import Bugsnag from "@bugsnag/expo";
import { Notes } from "@/components/Notes";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";
import type { Workout } from "@/store/workoutStore";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

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
  const { planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const { data: scheduleEntries = [] } = usePlanScheduleQuery(Number(planId));
  const { data: settings } = useSettingsQuery();
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const deletePlanMutation = useDeletePlanMutation();
  const setActivePlanMutation = useSetActivePlanMutation();

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
              <ActivityIndicator size="large" color="white" />
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
                  iconColor={Colors.dark.highlight}
                  onPressIn={handleDeletePlan}
                />
              </>
            ),
          }}
        />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.planHeader}>
          <Image source={imageSource} style={styles.planImage} />
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
          {plan?.app_plan_id ? <Trans>Customise Plan</Trans> : <Trans>Edit Plan</Trans>}
        </Button>
      </View>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={{
          backgroundColor: snackbarError ? "red" : Colors.dark.completed,
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

const styles = StyleSheet.create({
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
    borderRadius: 8,
  },
  planName: {
    fontSize: 24,
    lineHeight: 27,
    color: Colors.dark.text,
    marginTop: 10,
  },
  workoutCard: {
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  workoutTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontWeight: "bold",
  },
  workoutInfo: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: Colors.dark.background,
  },
  paperButton: {
    flex: 1,
    marginRight: 10,
  },
  buttonLabel: {
    paddingVertical: 0,
  },
  activeBadge: {
    backgroundColor: Colors.dark.completed,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    position: "absolute",
    top: 10,
    right: 10,
  },
  activeBadgeText: {
    color: Colors.dark.text,
    fontWeight: "bold",
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
});
