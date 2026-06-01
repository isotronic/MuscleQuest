import { useContext, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { UserExercise } from "@/store/workoutStore";
import { AppIcon, AppImage } from "@/components/ui";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Modal,
  Switch,
} from "react-native-paper";
import { Notes } from "@/components/Notes";
import { byteArrayToBase64, formatFromTotalSeconds } from "@/utils/utility";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useDeleteStandaloneWorkout } from "@/hooks/useCreateStandaloneWorkout";
import Bugsnag from "@bugsnag/expo";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { useWorkoutPublishQuery } from "@/hooks/useWorkoutPublishQuery";
import { useWorkoutPublishMutation } from "@/hooks/useWorkoutPublishMutation";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function StandaloneWorkoutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { workoutId: workoutIdParam } = useLocalSearchParams<{
    workoutId: string;
  }>();
  const workoutId = Number(workoutIdParam);
  const [isStarting, setIsStarting] = useState(false);

  const { data: standaloneWorkouts, isLoading } = useStandaloneWorkoutsQuery();
  const deleteMutation = useDeleteStandaloneWorkout();
  const { data: settings } = useSettingsQuery();
  const distanceUnit = settings?.distanceUnit || "m";

  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  const showShareToggle = !!user && !!privacySettings?.shareStandaloneWorkouts;
  const { data: isPublished = false, isLoading: isPublishLoading } =
    useWorkoutPublishQuery(showShareToggle ? workoutId : null);
  const publishMutation = useWorkoutPublishMutation(workoutId);

  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>
          <Trans>Workout not found.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  const workout = standaloneWorkouts?.find((w) => w.id === workoutId);

  const handleStart = () => {
    if (!workout) return;
    confirmStartWorkout(setIsStarting, () => {
      useActiveWorkoutStore
        .getState()
        .setWorkout(workout, null, workoutId, workout.name);
    });
  };

  const handleEdit = () => {
    router.push({
      pathname: "/(app)/(create-plan)/create-workout",
      params: { workoutId: workoutId.toString() },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t`Delete Workout`,
      t`Are you sure you want to delete "${workout?.name ?? ""}"?`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete`,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(workoutId);
              router.back();
            } catch (e: any) {
              Bugsnag.notify(e);
              Alert.alert(
                t`Error`,
                t`Failed to delete workout. Please try again.`,
              );
            }
          },
        },
      ],
    );
  };

  const renderExercise = (item: UserExercise) => {
    let base64Image: string | undefined;
    if (item.image && item.image.length > 0) {
      base64Image = `data:image/webp;base64,${byteArrayToBase64(item.image)}`;
    }

    const minReps = Math.min(...item.sets.map((s) => s.repsMin ?? Infinity));
    const maxReps = Math.max(...item.sets.map((s) => s.repsMax ?? -Infinity));
    let repRange: string | undefined;
    if (minReps !== Infinity && maxReps !== -Infinity) {
      repRange = minReps === maxReps ? `${minReps}` : `${minReps} - ${maxReps}`;
    } else if (maxReps !== -Infinity) {
      repRange = `${maxReps}`;
    } else if (minReps !== Infinity) {
      repRange = `${minReps}`;
    }

    const minTime = Math.min(...item.sets.map((s) => s.time ?? Infinity));
    const maxTime = Math.max(...item.sets.map((s) => s.time ?? -Infinity));
    let timeRange: string | undefined;
    if (minTime !== Infinity && maxTime !== -Infinity) {
      timeRange =
        minTime === maxTime
          ? formatFromTotalSeconds(minTime)
          : `${formatFromTotalSeconds(minTime)} - ${formatFromTotalSeconds(maxTime)}`;
    } else if (maxTime !== -Infinity) {
      timeRange = formatFromTotalSeconds(maxTime);
    } else if (minTime !== Infinity) {
      timeRange = formatFromTotalSeconds(minTime);
    }

    const minDist = Math.min(...item.sets.map((s) => s.distance ?? Infinity));
    const maxDist = Math.max(...item.sets.map((s) => s.distance ?? -Infinity));
    let distanceRange: string | undefined;
    if (minDist !== Infinity && maxDist !== -Infinity) {
      distanceRange =
        minDist === maxDist ? `${minDist}` : `${minDist} - ${maxDist}`;
    } else if (maxDist !== -Infinity) {
      distanceRange = `${maxDist}`;
    } else if (minDist !== Infinity) {
      distanceRange = `${minDist}`;
    }

    const isToFailure = item.sets.some((s) => s.isToFailure);

    return (
      <TouchableOpacity
        key={item.exercise_id}
        onPress={() =>
          router.push({
            pathname: "/(app)/exercise-info",
            params: { exercise_id: item.exercise_id.toString() },
          })
        }
      >
        <View style={styles.exerciseItem}>
          {base64Image ? (
            <AppImage
              style={styles.exerciseImage}
              source={{ uri: base64Image }}
            />
          ) : item.local_animated_uri ? (
            <AppImage
              style={styles.exerciseImage}
              source={{ uri: item.local_animated_uri }}
            />
          ) : (
            <AppImage style={styles.exerciseImage} source={fallbackImage} />
          )}
          <View style={styles.exerciseInfo}>
            <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
            <ThemedText style={styles.exerciseSets}>
              {item.sets.length ? t`${item.sets.length} Sets` : t`No Sets`}
              {item.tracking_type === "time"
                ? timeRange
                  ? ` | ${timeRange}${isToFailure ? t` (to Failure)` : ""}`
                  : ""
                : item.tracking_type === "distance"
                  ? distanceRange
                    ? ` | ${distanceRange} ${distanceUnit}`
                    : ""
                  : repRange
                    ? ` | ${repRange}${isToFailure ? t` (to Failure) ` : " "}${t`Reps`}`
                    : ""}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.contentPrimary} />
      </ThemedView>
    );
  }

  if (!workout) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>
          <Trans>Workout not found.</Trans>
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {isStarting && (
        <Portal>
          <Modal visible={isStarting} dismissable={false}>
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.contentPrimary} />
              <ThemedText
                style={{ marginTop: 12, color: colors.contentPrimary }}
              >
                <Trans>Starting Workout...</Trans>
              </ThemedText>
            </View>
          </Modal>
        </Portal>
      )}
      <Stack.Screen
        options={{
          title: workout.name,
          headerRight: () => (
            <>
              <Notes
                noteType="workout"
                referenceId={workoutId}
                buttonType="icon"
              />
              <IconButton
                icon="trash-can-outline"
                size={25}
                iconColor={colors.danger}
                onPress={handleDelete}
              />
            </>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {workout.exercises.length === 0 ? (
          <ThemedText style={styles.emptyText}>
            <Trans>No exercises in this workout yet.</Trans>
          </ThemedText>
        ) : (
          workout.exercises.map((exercise) => renderExercise(exercise))
        )}
        {showShareToggle && (
          <>
            <TouchableOpacity
              onPress={() => publishMutation.mutate(!isPublished)}
              style={styles.shareRow}
              activeOpacity={0.7}
              disabled={publishMutation.isPending || isPublishLoading}
            >
              <View style={styles.shareLeft}>
                <AppIcon
                  set="mci"
                  name="cloud-outline"
                  size={20}
                  color={isPublished ? colors.accent : colors.contentSecondary}
                  style={{ marginRight: 10 }}
                />
                <ThemedText
                  style={[
                    styles.shareTitle,
                    isPublished && { color: colors.accent },
                  ]}
                >
                  <Trans>Share Workout</Trans>
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
            {publishMutation.isError && (
              <ThemedText style={[styles.shareError, { color: colors.danger }]}>
                <Trans>Failed to update sharing. Please try again.</Trans>
              </ThemedText>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.startButtonContainer}>
        <Button
          mode="contained"
          onPress={handleStart}
          disabled={isStarting || workout.exercises.length === 0}
          theme={{ colors: { primary: colors.accent } }}
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Start Workout</Trans>
        </Button>
        <Button
          mode="outlined"
          onPress={handleEdit}
          theme={{ colors: { primary: colors.accent } }}
          style={styles.editButton}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Edit Workout</Trans>
        </Button>
      </View>
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    exerciseItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 10,
      borderRadius: radii.md,
    },
    exerciseImage: {
      width: 70,
      height: 70,
      marginRight: 16,
      borderRadius: radii.md,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 18,
      color: colors.contentPrimary,
    },
    exerciseSets: {
      fontSize: 14,
      color: colors.contentSecondary,
    },
    emptyText: {
      textAlign: "center",
      color: colors.contentSecondary,
      marginTop: 40,
    },
    startButtonContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 16,
      paddingBottom: 24,
      backgroundColor: colors.surface,
    },
    startButton: {
      flex: 1,
      marginRight: 8,
      borderRadius: radii.md,
    },
    editButton: {
      flex: 1,
      borderRadius: radii.md,
    },
    startButtonLabel: {
      fontSize: 16,
      paddingVertical: 4,
    },
    shareRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      padding: 14,
      marginTop: 16,
    },
    shareLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    shareTitle: {
      fontSize: 15,
      fontWeight: "600",
    },
    shareError: {
      fontSize: 13,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
  });
}
