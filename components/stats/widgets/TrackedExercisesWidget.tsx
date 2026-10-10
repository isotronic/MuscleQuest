import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useFocusEffect, useRouter } from "expo-router";
import Sortable from "react-native-sortables";
import { ThemedText } from "@/components/ThemedText";
import { ExerciseCompactCard } from "@/components/stats/ExerciseCompactCard";
import { useTrackedExercisesQuery } from "@/hooks/useTrackedExercisesQuery";
import { useReorderTrackedExercisesMutation } from "@/hooks/useReorderTrackedExercisesMutation";
import type { WidgetConfigs } from "@/utils/statsLayout";
import { useAppTheme } from "@/theme";
import { exerciseHref } from "@/utils/exerciseHref";
import { useStatsWidgetContext } from "./StatsWidgetContext";
import { WidgetSection } from "./WidgetSection";

export const TrackedExercisesWidget: React.FC<{
  config: WidgetConfigs["tracked"];
}> = ({ config }) => {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { globalRange, statsOptions, excludeDeload, weightUnit, distanceUnit } =
    useStatsWidgetContext();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const reorderMutation = useReorderTrackedExercisesMutation();
  const tracked = useTrackedExercisesQuery(
    globalRange,
    statsOptions.excludeWarmup,
    statsOptions.countUnilateralDouble,
    statsOptions.doubleWeightForPaired,
    excludeDeload,
  );
  const trackedExercises = tracked.data;

  useFocusEffect(
    useCallback(() => {
      return () => setIsReorderMode(false);
    }, []),
  );

  const handleExercisePress = useCallback(
    (exerciseId: number) => router.push(exerciseHref(exerciseId, "progress")),
    [router],
  );

  const handleManageExercisesPress = useCallback(() => {
    router.push({
      pathname: "/(app)/(tabs)/(stats)/exercises",
      params: {
        selectedExercises: JSON.stringify(
          trackedExercises?.map((te) => te.exercise_id),
        ),
      },
    });
  }, [router, trackedExercises]);

  const handleReorderDragEnd = useCallback(
    ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
      if (fromIndex === toIndex) return;
      const reordered = [...(trackedExercises ?? [])];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      reorderMutation.mutate(reordered.map((e) => e.exercise_id));
    },
    [trackedExercises, reorderMutation],
  );

  const actions = (
    <View style={styles.buttons}>
      {!isReorderMode && (
        <Button
          mode="text"
          compact
          labelStyle={{ color: colors.accent, fontSize: 13 }}
          onPress={handleManageExercisesPress}
        >
          {trackedExercises && trackedExercises.length > 0 ? (
            <Trans>Manage</Trans>
          ) : (
            <Trans>+ Add</Trans>
          )}
        </Button>
      )}
      {trackedExercises && trackedExercises.length > 1 && (
        <Button
          mode="text"
          compact
          labelStyle={{
            color: isReorderMode ? colors.accent : colors.contentSecondary,
            fontSize: 13,
          }}
          onPress={() => setIsReorderMode((v) => !v)}
        >
          {isReorderMode ? <Trans>Done</Trans> : <Trans>Reorder</Trans>}
        </Button>
      )}
    </View>
  );

  return (
    <WidgetSection
      title={t`Pinned exercises`}
      actions={actions}
      loading={tracked.isLoading}
      error={!!tracked.error}
    >
      {trackedExercises && trackedExercises.length > 0 ? (
        isReorderMode ? (
          <Sortable.Grid
            columns={1}
            data={trackedExercises}
            keyExtractor={(item) => item.exercise_id.toString()}
            renderItem={({ item }) => (
              <ExerciseCompactCard
                exercise={item}
                weightUnit={weightUnit}
                distanceUnit={distanceUnit}
                showSparkline={config.showSparkline}
                isReorderMode
                onPress={() => {}}
              />
            )}
            onDragEnd={handleReorderDragEnd}
            showDropIndicator
          />
        ) : (
          trackedExercises.map((exercise) => (
            <ExerciseCompactCard
              key={exercise.exercise_id}
              exercise={exercise}
              weightUnit={weightUnit}
              distanceUnit={distanceUnit}
              showSparkline={config.showSparkline}
              onPress={() => handleExercisePress(exercise.exercise_id)}
            />
          ))
        )
      ) : (
        <ThemedText style={{ color: colors.contentSecondary }}>
          <Trans>
            No pinned exercises yet. Tap + Add, or the pin on any exercise.
          </Trans>
        </ThemedText>
      )}
    </WidgetSection>
  );
};

const styles = StyleSheet.create({
  buttons: {
    flexDirection: "row",
    alignItems: "center",
  },
});
