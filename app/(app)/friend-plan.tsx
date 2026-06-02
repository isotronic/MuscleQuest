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
import { AppText, AppIcon } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { useFriendSharedPlansQuery } from "@/hooks/useFriendSharedPlansQuery";
import { useImportPlanMutation } from "@/hooks/useImportPlanMutation";

export default function FriendPlanScreen() {
  const { friendUid, planId } = useLocalSearchParams<{
    friendUid: string;
    planId: string;
  }>();
  const { colors, borders } = useAppTheme();

  const { data: plans = [], isLoading } = useFriendSharedPlansQuery(friendUid);
  const plan = plans.find((p) => String(p.localPlanId) === planId);

  const importPlan = useImportPlanMutation();
  const [imported, setImported] = useState(false);

  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<number>>(
    new Set([0]),
  );
  const toggleWorkout = (index: number) =>
    setExpandedWorkouts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText variant="body" style={{ color: colors.contentSecondary }}>
          <Trans>Plan not found.</Trans>
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
          {plan.name}
        </AppText>
        <AppText
          variant="caption"
          style={{ color: colors.contentSecondary, marginBottom: 24 }}
        >
          <Trans>
            Updated{" "}
            {formatDistanceToNow(plan.updatedAt.toDate(), { addSuffix: true })}
          </Trans>
        </AppText>

        {plan.workouts.map((workout, index) => (
          <View key={index} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.workoutRow, { borderColor: borders.divider }]}
              onPress={() => toggleWorkout(index)}
              activeOpacity={0.7}
            >
              <AppText
                variant="bodyBold"
                style={{ flex: 1, color: colors.contentPrimary }}
              >
                {workout.name}
              </AppText>
              <AppIcon
                set="ion"
                name={
                  expandedWorkouts.has(index) ? "chevron-up" : "chevron-down"
                }
                size={16}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>

            {expandedWorkouts.has(index) &&
              workout.exercises.map((exercise, eIndex) => (
                <View
                  key={eIndex}
                  style={[
                    styles.exerciseRow,
                    { borderBottomColor: borders.divider },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText
                      variant="body"
                      style={{ color: colors.contentPrimary }}
                    >
                      {exercise.name}
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{ color: colors.contentSecondary }}
                    >
                      {exercise.sets.length} <Trans>sets</Trans>
                      {exercise.sets[0]?.repsMin != null &&
                        exercise.sets[0]?.repsMax != null && (
                          <>
                            {" "}
                            · {exercise.sets[0].repsMin}–
                            {exercise.sets[0].repsMax} <Trans>reps</Trans>
                          </>
                        )}
                    </AppText>
                  </View>
                </View>
              ))}
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
              opacity: importPlan.isPending ? 0.7 : 1,
            },
          ]}
          onPress={() =>
            importPlan.mutate(plan, { onSuccess: () => setImported(true) })
          }
          disabled={imported || importPlan.isPending}
        >
          {importPlan.isPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <AppText
              variant="bodyBold"
              style={{
                color: imported ? colors.contentSecondary : colors.onAccent,
              }}
            >
              {imported ? (
                <Trans>Added to my plans</Trans>
              ) : (
                <Trans>Add to my plans</Trans>
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
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginBottom: 2,
  },
  exerciseRow: {
    paddingVertical: 8,
    paddingHorizontal: 16,
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
