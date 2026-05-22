import { useState } from "react";
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
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Modal,
} from "react-native-paper";
import { Notes } from "@/components/Notes";
import { byteArrayToBase64, formatFromTotalSeconds } from "@/utils/utility";
import { Colors } from "@/constants/Colors";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useDeleteStandaloneWorkout } from "@/hooks/useCreateStandaloneWorkout";
import Bugsnag from "@bugsnag/expo";
import { confirmStartWorkout } from "@/utils/startWorkout";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function StandaloneWorkoutScreen() {
  const { workoutId: workoutIdParam } = useLocalSearchParams<{
    workoutId: string;
  }>();
  const workoutId = Number(workoutIdParam);
  const [isStarting, setIsStarting] = useState(false);

  const { data: standaloneWorkouts, isLoading } = useStandaloneWorkoutsQuery();
  const deleteMutation = useDeleteStandaloneWorkout();
  const { data: settings } = useSettingsQuery();
  const distanceUnit = settings?.distanceUnit || "m";

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
            <Image style={styles.exerciseImage} source={{ uri: base64Image }} />
          ) : item.local_animated_uri ? (
            <Image
              style={styles.exerciseImage}
              source={{ uri: item.local_animated_uri }}
            />
          ) : (
            <Image style={styles.exerciseImage} source={fallbackImage} />
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
        <ActivityIndicator size="large" color={Colors.dark.text} />
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
              <ActivityIndicator size="large" color="white" />
              <ThemedText style={{ marginTop: 12, color: "white" }}>
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
                iconColor={Colors.dark.highlight}
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
      </ScrollView>
      <View style={styles.startButtonContainer}>
        <Button
          mode="contained"
          onPress={handleStart}
          disabled={isStarting || workout.exercises.length === 0}
          theme={{ colors: { primary: Colors.dark.tint } }}
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Start Workout</Trans>
        </Button>
        <Button
          mode="outlined"
          onPress={handleEdit}
          theme={{ colors: { primary: Colors.dark.tint } }}
          style={styles.editButton}
          labelStyle={styles.startButtonLabel}
        >
          <Trans>Edit Workout</Trans>
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    marginRight: 16,
    borderRadius: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  exerciseSets: {
    fontSize: 14,
    color: Colors.dark.subText,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.dark.subText,
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
    backgroundColor: Colors.dark.screenBackground,
  },
  startButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  editButton: {
    flex: 1,
    borderRadius: 8,
  },
  startButtonLabel: {
    fontSize: 16,
    paddingVertical: 4,
  },
});
