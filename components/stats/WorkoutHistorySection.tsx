import React from "react";
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
        renderItem={({ item }: { item: CompletedWorkout }) => (
          <WorkoutHistoryCard
            workout={item}
            onPress={() => onWorkoutPress(item.id)}
            excludeWarmup={excludeWarmup}
          />
        )}
        keyExtractor={(item: CompletedWorkout) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};
