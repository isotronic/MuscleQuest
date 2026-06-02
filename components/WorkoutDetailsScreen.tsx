import { useMemo } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { UserExercise } from "@/store/workoutStore";
import { AppImage } from "@/components/ui";
import { byteArrayToBase64, formatFromTotalSeconds } from "@/utils/utility";
import { classifySupersetPosition } from "@/utils/supersetUtils";
import Bugsnag from "@bugsnag/expo";
import { Notes } from "@/components/Notes";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useProgressionSettingsQuery } from "@/hooks/useProgressionSettingsQuery";
import { useWorkoutProgressionStatesQuery } from "@/hooks/useWorkoutProgressionStatesQuery";
import ProgressionSuggestionChip from "@/components/ProgressionSuggestionChip";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

const fallbackImage = require("@/assets/images/placeholder.webp");

export default function WorkoutDetailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { workoutIndex, planId } = useLocalSearchParams();
  const { data: plan, isLoading, error } = usePlanQuery(Number(planId));
  const { data: settings } = useSettingsQuery();
  const distanceUnit = settings?.distanceUnit || "m";
  const weightUnit = settings?.weightUnit || "kg";
  const progressionSettings = useProgressionSettingsQuery();

  const workout = plan?.workouts[Number(workoutIndex)];
  const { data: progressionStates } = useWorkoutProgressionStatesQuery(
    progressionSettings.enabled && workout?.id != null ? workout.id : undefined,
  );

  const appliedSuggestions = useMemo(
    () =>
      (progressionStates ?? []).filter(
        (s) => s.isApplied && s.suggestionAction !== "hold",
      ),
    [progressionStates],
  );

  const renderExerciseItem = ({
    item,
    index: exerciseIndex,
  }: {
    item: UserExercise;
    index: number;
  }) => {
    let base64Image: string | undefined;
    if (item.image) {
      const base64String = byteArrayToBase64(item.image);
      base64Image = `data:image/webp;base64,${base64String}`;
    }

    const exercises = workout?.exercises ?? [];
    const { isInSuperset, isFirstInSuperset, isSecondInSuperset } =
      classifySupersetPosition(exercises, exerciseIndex);

    const minReps = Math.min(
      ...item.sets.map((set) => set.repsMin ?? Infinity),
    );
    const maxReps = Math.max(
      ...item.sets.map((set) => set.repsMax ?? -Infinity),
    );

    let repRange;
    if (minReps === Infinity && maxReps !== -Infinity) {
      repRange = `${maxReps}`;
    } else if (maxReps === -Infinity && minReps !== Infinity) {
      repRange = `${minReps}`;
    } else if (minReps !== Infinity && maxReps !== -Infinity) {
      repRange = `${minReps} - ${maxReps}`;
    }

    const minTime = Math.min(...item.sets.map((set) => set.time ?? Infinity));
    const maxTime = Math.max(...item.sets.map((set) => set.time ?? -Infinity));

    let timeRange;
    if (minTime === Infinity && maxTime !== -Infinity) {
      timeRange = `${formatFromTotalSeconds(maxTime)}`;
    } else if (maxTime === -Infinity && minTime !== Infinity) {
      timeRange = `${formatFromTotalSeconds(minTime)}`;
    } else if (minTime === maxTime) {
      timeRange = `${formatFromTotalSeconds(minTime)}`;
    } else if (minTime !== Infinity && maxTime !== -Infinity) {
      timeRange = `${formatFromTotalSeconds(minTime)} - ${formatFromTotalSeconds(maxTime)}`;
    }

    const minDist = Math.min(
      ...item.sets.map((set) => set.distance ?? Infinity),
    );
    const maxDist = Math.max(
      ...item.sets.map((set) => set.distance ?? -Infinity),
    );

    let distanceRange: string | undefined;
    if (minDist !== Infinity && maxDist !== -Infinity) {
      distanceRange =
        minDist === maxDist ? `${minDist}` : `${minDist} - ${maxDist}`;
    } else if (minDist !== Infinity) {
      distanceRange = `${minDist}`;
    } else if (maxDist !== -Infinity) {
      distanceRange = `${maxDist}`;
    }

    const isToFailure = item.sets.some((set) => set.isToFailure);

    const exerciseItem = { ...item, image: undefined };

    return (
      <View>
        {isFirstInSuperset && (
          <View style={styles.supersetHeader}>
            <ThemedText style={styles.supersetHeaderText}>
              <Trans>Superset</Trans>
            </ThemedText>
          </View>
        )}
        <TouchableOpacity
          onPress={() => {
            router.push({
              pathname: "/(app)/exercise-info",
              params: { exercise_id: exerciseItem.exercise_id.toString() },
            });
          }}
        >
          <View
            style={[
              styles.exerciseItem,
              isInSuperset && styles.supersetExerciseItem,
              isFirstInSuperset && styles.supersetExerciseFirst,
              isSecondInSuperset && styles.supersetExerciseLast,
            ]}
          >
            {item.image.length > 0 ? (
              <AppImage
                style={styles.exerciseImage}
                source={{ uri: base64Image }}
              />
            ) : item.local_animated_uri ? (
              <AppImage
                style={styles.exerciseImage}
                source={item.local_animated_uri}
              />
            ) : (
              <AppImage style={styles.exerciseImage} source={fallbackImage} />
            )}
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
              <ThemedText style={styles.exerciseSets}>
                {item?.sets?.length
                  ? t`${item.sets.length} Sets`
                  : t`No Sets Available`}
                {item.tracking_type === "time"
                  ? timeRange
                    ? ` | ${timeRange} ${isToFailure ? t`(to Failure)` : ""}`
                    : ""
                  : item.tracking_type === "distance"
                    ? distanceRange
                      ? ` | ${distanceRange} ${distanceUnit}`
                      : ""
                    : repRange
                      ? ` | ${repRange} ${isToFailure ? t`(to Failure) ` : ""}${t`Reps`}`
                      : ""}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
        {isFirstInSuperset && <View style={styles.supersetConnector} />}
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedText>
        <Trans>Loading...</Trans>
      </ThemedText>
    );
  }

  if (error) {
    Bugsnag.notify(error);
    return (
      <ThemedText>
        <Trans>Error: {error.message}</Trans>
      </ThemedText>
    );
  }

  const previewHeader =
    appliedSuggestions.length > 0 ? (
      <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
        <ThemedText style={styles.previewTitle}>
          <Trans>Changes for this session</Trans>
        </ThemedText>
        {appliedSuggestions.map((s) => (
          <View key={s.userWorkoutExerciseId} style={styles.previewRow}>
            <ThemedText
              style={[styles.previewExercise, { color: colors.contentPrimary }]}
              numberOfLines={1}
            >
              {s.exerciseName}
            </ThemedText>
            <ProgressionSuggestionChip
              action={s.suggestionAction}
              suggestedWeight={s.suggestedWeight}
              suggestedRepsPerSet={s.suggestedRepsPerSet}
              weightUnit={weightUnit}
            />
          </View>
        ))}
      </View>
    ) : null;

  return (
    <ThemedView>
      <Stack.Screen
        options={{
          title: workout?.name,
          headerRight: () => (
            <Notes
              noteType="workout"
              referenceId={workout?.id || 0}
              buttonType="icon"
            />
          ),
        }}
      />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        data={workout?.exercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item: any, index: number) => index.toString()}
        ListHeaderComponent={previewHeader}
      />
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: 16,
      paddingBottom: 30,
      paddingHorizontal: 16,
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
      color: colors.contentPrimary,
    },
    supersetHeader: {
      paddingHorizontal: 4,
      paddingBottom: 0,
      marginTop: -8,
    },
    supersetHeaderText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    supersetConnector: {
      width: 3,
      height: 6,
      backgroundColor: colors.accent,
      marginLeft: 27,
    },
    previewCard: {
      borderRadius: radii.md,
      padding: 14,
      marginBottom: 12,
      gap: 10,
    },
    previewTitle: {
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: colors.accent,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    previewExercise: {
      flex: 1,
      fontSize: 14,
    },
    supersetExerciseItem: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    supersetExerciseFirst: {
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    supersetExerciseLast: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      marginBottom: 8,
    },
  });
}
