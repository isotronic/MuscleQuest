import React, { useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { formatDistanceToNow } from "date-fns";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { useFriendSharedStandaloneWorkoutsQuery } from "@/hooks/useFriendSharedStandaloneWorkoutsQuery";
import { useImportStandaloneWorkoutMutation } from "@/hooks/useImportStandaloneWorkoutMutation";

export default function FriendWorkoutScreen() {
  const { friendUid, workoutId } = useLocalSearchParams<{
    friendUid: string;
    workoutId: string;
  }>();
  const { colors, borders } = useAppTheme();

  const { data: workouts = [], isLoading } =
    useFriendSharedStandaloneWorkoutsQuery(friendUid);
  const workout = workouts.find((w) => String(w.localWorkoutId) === workoutId);

  const importWorkout = useImportStandaloneWorkoutMutation();
  const [imported, setImported] = useState(false);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText variant="body" style={{ color: colors.contentSecondary }}>
          <Trans>Workout not found.</Trans>
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText
          variant="title"
          style={{ color: colors.contentPrimary, marginBottom: 4 }}
        >
          {workout.name}
        </AppText>
        <AppText
          variant="caption"
          style={{ color: colors.contentSecondary, marginBottom: 24 }}
        >
          <Trans>
            Updated{" "}
            {formatDistanceToNow(workout.updatedAt.toDate(), {
              addSuffix: true,
            })}
          </Trans>
        </AppText>

        {workout.exercises.map((exercise, index) => (
          <View
            key={index}
            style={[styles.exerciseRow, { borderBottomColor: borders.divider }]}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ color: colors.contentPrimary }}>
                {exercise.name}
              </AppText>
              <AppText
                variant="caption"
                style={{ color: colors.contentSecondary }}
              >
                {exercise.sets.length} <Trans>sets</Trans>
                {exercise.sets[0]?.repsMin != null &&
                  ` · ${exercise.sets[0].repsMin}–${exercise.sets[0].repsMax} reps`}
              </AppText>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderTopColor: borders.divider,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.importButton,
            {
              backgroundColor: imported ? colors.card : colors.accent,
              opacity: importWorkout.isPending ? 0.7 : 1,
            },
          ]}
          onPress={() =>
            importWorkout.mutate(workout, {
              onSuccess: () => setImported(true),
            })
          }
          disabled={imported || importWorkout.isPending}
        >
          {importWorkout.isPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <AppText
              variant="bodyBold"
              style={{
                color: imported ? colors.contentSecondary : colors.onAccent,
              }}
            >
              {imported ? (
                <Trans>Added to my workouts</Trans>
              ) : (
                <Trans>Add to my workouts</Trans>
              )}
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  exerciseRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  importButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
});
