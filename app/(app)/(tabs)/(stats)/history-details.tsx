import { useState, useMemo, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Trans, Plural } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Image } from "expo-image";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ActivityIndicator, Card, IconButton } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { byteArrayToBase64 } from "@/utils/utility";
import { parseISO, format } from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { fetchCompletedWorkoutById } from "@/utils/database";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { useDeleteCompletedWorkoutMutation } from "@/hooks/useDeleteCompletedWorkoutMutation";
import { formatFromTotalSeconds } from "@/utils/utility";
import Bugsnag from "@bugsnag/expo";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function HistoryDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useSettingsQuery();

  const weightUnit = settings?.weightUnit || "kg";
  const distanceUnit = settings?.distanceUnit || "m";
  const bodyWeight = parseFloat(settings?.bodyWeight || "70");
  const excludeWarmup = settings?.excludeWarmupSets === "true";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const doubleWeightForPaired = settings?.doubleWeightForPaired === "true";

  useEffect(() => {
    if (settingsError instanceof Error) {
      Bugsnag.notify(settingsError);
    }
  }, [settingsError]);

  const deleteMutation = useDeleteCompletedWorkoutMutation();

  useFocusEffect(
    useCallback(() => {
      const numId = Number(Array.isArray(id) ? id[0] : id);
      if (!numId) {
        setIsLoading(false);
        setWorkout(null);
        return;
      }

      let cancelled = false;
      setIsLoading(true);
      setError(null);

      fetchCompletedWorkoutById(numId, weightUnit, distanceUnit)
        .then((data) => {
          if (!cancelled) {
            setWorkout(data);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setWorkout(null);
            setIsLoading(false);
            Bugsnag.notify(err);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [id, weightUnit, distanceUnit]),
  );

  const totalVolume = useMemo(() => {
    if (!workout) return 0;

    return workout.exercises.reduce((exerciseAcc, exercise) => {
      const weightM = doubleWeightForPaired && exercise.double_weight ? 2 : 1;
      const repM = countUnilateralDouble && exercise.is_unilateral ? 2 : 1;
      const exerciseVolume = exercise.sets.reduce((setAcc, set) => {
        if (excludeWarmup && set.is_warmup) return setAcc;
        const weight =
          exercise.exercise_tracking_type === "assisted"
            ? bodyWeight - (set.weight || 0)
            : (set.weight || 0) * weightM;
        return setAcc + weight * (set.reps || 0) * repM;
      }, 0);

      return parseFloat((exerciseAcc + exerciseVolume).toFixed(1));
    }, 0);
  }, [
    workout,
    bodyWeight,
    excludeWarmup,
    countUnilateralDouble,
    doubleWeightForPaired,
  ]);

  if (isLoading || settingsLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.text} />
      </ThemedView>
    );
  }

  if (settingsError instanceof Error) {
    return <ThemedText>Error: {settingsError.message}</ThemedText>;
  }

  if (error) {
    return <ThemedText>Error: {error.message}</ThemedText>;
  }

  if (!workout) {
    return null;
  }

  const isoDateString = workout.date_completed.replace(" ", "T");
  const parsedDate = parseISO(isoDateString);
  const formattedDate = format(parsedDate, "dd/MM/yyyy 'at' HH:mm");

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="file-document-edit-outline"
                size={25}
                style={{ marginRight: 0 }}
                iconColor={Colors.dark.text}
                onPressIn={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/(stats)/edit-history",
                    params: { id },
                  })
                }
              />
              <IconButton
                icon="trash-can-outline"
                size={25}
                style={{ marginRight: 0 }}
                iconColor={Colors.dark.highlight}
                onPressIn={() => {
                  if (typeof id !== "string" || !/^\d+$/.test(id)) return;
                  const parsedId = parseInt(id, 10);
                  if (parsedId <= 0) return;
                  Alert.alert(
                    t`Delete Workout`,
                    t`Are you sure you want to delete this workout? This action cannot be undone.`,
                    [
                      { text: t`Cancel`, style: "cancel" },
                      {
                        text: t`Delete`,
                        style: "destructive",
                        onPress: () => deleteMutation.mutate(parsedId),
                      },
                    ],
                  );
                }}
              />
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Top Section */}
        <View style={styles.topSection}>
          <ThemedText style={styles.workoutName}>
            {workout.workout_name}
          </ThemedText>
          <ThemedText style={styles.workoutDate}>
            <Trans>Completed on: {formattedDate}</Trans>
          </ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="clock"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              <Plural value={Math.round(workout.duration / 60)} one="# min" other="# mins" />
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="numeric"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              <Plural value={workout.total_sets_completed} one="# set" other="# sets" />
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons
              name="scale"
              size={24}
              color={Colors.dark.icon}
            />
            <ThemedText style={styles.summaryText}>
              {totalVolume} {settings?.weightUnit}
            </ThemedText>
          </View>
        </View>

        {/* Exercise List */}
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise) => {
            let imageUri = "";
            if (exercise.exercise_image) {
              const base64Image = byteArrayToBase64(exercise.exercise_image);
              imageUri = `data:image/webp;base64,${base64Image}`;
            }

            return (
              <Card key={exercise.exercise_id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.exerciseImage}
                    />
                  ) : (
                    <Image
                      source={fallbackImage}
                      style={styles.exerciseImage}
                    />
                  )}
                  <ThemedText style={styles.exerciseName}>
                    {exercise.exercise_name}
                  </ThemedText>
                </View>
                {/* Sets List */}
                {exercise.sets.map((set, index) => (
                  <View key={index} style={styles.setRow}>
                    <ThemedText style={styles.setText}>
                      <Trans>Set {set.set_number}</Trans>
                    </ThemedText>
                    {exercise.exercise_tracking_type === "time" ? (
                      <ThemedText style={styles.setText}>
                        {set.time != null
                          ? formatFromTotalSeconds(set.time)
                          : "—"}
                      </ThemedText>
                    ) : exercise.exercise_tracking_type === "reps" ? (
                      <ThemedText style={styles.setText}>
                        <Plural value={set.reps} one="# Rep" other="# Reps" />
                      </ThemedText>
                    ) : exercise.exercise_tracking_type === "distance" ? (
                      <ThemedText style={styles.setText}>
                        {set.distance} {distanceUnit}
                      </ThemedText>
                    ) : exercise.exercise_tracking_type === "weight" ? (
                      <ThemedText style={styles.setText}>
                        <Trans>
                          {set.weight} {settings?.weightUnit} | {set.reps} Reps
                        </Trans>
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.setText}>
                        <Trans>
                          Assist {set.weight} {settings?.weightUnit} | Resist{" "}
                          {bodyWeight - (set.weight || 0)}{" "}
                          {settings?.weightUnit} | {set.reps} Reps
                        </Trans>
                      </ThemedText>
                    )}
                  </View>
                ))}
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  topSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  workoutName: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: "bold",
  },
  workoutDate: {
    fontSize: 16,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryText: {
    fontSize: 16,
    marginTop: 4,
  },
  exerciseList: {
    marginBottom: 50,
  },
  exerciseCard: {
    marginBottom: 16,
    borderRadius: 8,
    paddingBottom: 8,
    elevation: 2, // For Android
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)", // For iOS
    backgroundColor: Colors.dark.cardBackground,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    flexWrap: "wrap",
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  setText: {
    fontSize: 16,
  },
});
