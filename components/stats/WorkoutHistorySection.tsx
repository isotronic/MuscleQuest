import React, { useCallback } from "react";
import { FlatList, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import WorkoutHistoryCard from "@/components/WorkoutHistoryCard";
import { CompletedWorkout } from "@/hooks/useCompletedWorkoutsQuery";
import { Trans } from "@lingui/react/macro";

interface WorkoutHistorySectionProps {
  completedWorkouts: CompletedWorkout[];
  onWorkoutPress: (id: number) => void;
  excludeWarmup?: boolean;
}

export const WorkoutHistorySection: React.FC<WorkoutHistorySectionProps> = ({
  completedWorkouts,
  onWorkoutPress,
  excludeWarmup = false,
}) => {
  const renderItem = useCallback(
    ({ item }: { item: CompletedWorkout }) => (
      <WorkoutHistoryCard
        workout={item}
        onPress={onWorkoutPress}
        excludeWarmup={excludeWarmup}
      />
    ),
    [onWorkoutPress, excludeWarmup],
  );

  const keyExtractor = useCallback(
    (item: CompletedWorkout) => item.id.toString(),
    [],
  );

  if (completedWorkouts.length === 0) {
    return (
      <ThemedText>
        <Trans>No workouts completed yet. Start your first workout!</Trans>
      </ThemedText>
    );
  }

  return (
    <View>
      <FlatList
        data={completedWorkouts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};
