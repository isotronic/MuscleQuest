import React, { useContext, useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Avatar } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { plural } from "@lingui/core/macro";
import { formatDistanceToNow } from "date-fns";
import { AppText, AppIcon } from "@/components/ui";
import { useAppTheme, radii } from "@/theme";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { useFriendSharedPlansQuery } from "@/hooks/useFriendSharedPlansQuery";
import { useFriendSharedStandaloneWorkoutsQuery } from "@/hooks/useFriendSharedStandaloneWorkoutsQuery";
import { useFriendSharedCustomExercisesQuery } from "@/hooks/useFriendSharedCustomExercisesQuery";
import { useFriendSharedCompletedWorkoutsQuery } from "@/hooks/useFriendSharedCompletedWorkoutsQuery";
import { useFriendSharedMeasurementsQuery } from "@/hooks/useFriendSharedMeasurementsQuery";
import { useFriendSharedStrengthQuery } from "@/hooks/useFriendSharedStrengthQuery";
import { useImportPlanMutation } from "@/hooks/useImportPlanMutation";
import { useImportStandaloneWorkoutMutation } from "@/hooks/useImportStandaloneWorkoutMutation";
import { useImportCustomExerciseMutation } from "@/hooks/useImportCustomExerciseMutation";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import type { AppThemeColors, AppThemeBorders } from "@/theme/types";
import type { SharedStrengthPR } from "@/types/firestore";

function formatPR(pr: SharedStrengthPR, weightUnit: string): string {
  const convFactor = weightUnit === "lbs" ? 2.2046226 : 1;
  switch (pr.trackingType) {
    case "reps":
      return plural(Math.round(pr.allTimePR), {
        one: "# rep",
        other: "# reps",
      });
    case "time":
      return `${Math.round(pr.allTimePR)}s`;
    case "distance":
      return `${pr.allTimePR.toFixed(1)} m`;
    default:
      return `1RM ${(pr.allTimePR * convFactor).toFixed(1)} ${weightUnit}`;
  }
}

function formatMeasurementSummary(values: Record<string, number>): string {
  return Object.entries(values)
    .slice(0, 3)
    .map(
      ([k, v]) =>
        `${k.charAt(0).toUpperCase() + k.slice(1)}: ${parseFloat(v.toFixed(1))}`,
    )
    .join("  ·  ");
}

export default function FriendProfileScreen() {
  const { friendUid } = useLocalSearchParams<{ friendUid: string }>();
  const { colors, borders } = useAppTheme();
  const router = useRouter();
  const user = useContext(AuthContext);
  const { friends } = useSocialStore();
  const { data: settings } = useSettingsQuery();
  const weightUnit = settings?.weightUnit ?? "kg";

  const friend = friends.find((f) => f.uid === friendUid) ?? null;

  const { data: plans = [], isLoading: plansLoading } =
    useFriendSharedPlansQuery(friendUid);
  const { data: workouts = [], isLoading: workoutsLoading } =
    useFriendSharedStandaloneWorkoutsQuery(friendUid);
  const { data: exercises = [], isLoading: exercisesLoading } =
    useFriendSharedCustomExercisesQuery(friendUid);
  const { data: completedWorkouts = [], isLoading: completedLoading } =
    useFriendSharedCompletedWorkoutsQuery(friendUid);
  const { data: measurements = [], isLoading: measurementsLoading } =
    useFriendSharedMeasurementsQuery(friendUid);
  const { data: strength = [], isLoading: strengthLoading } =
    useFriendSharedStrengthQuery(friendUid);

  const importPlan = useImportPlanMutation();
  const importWorkout = useImportStandaloneWorkoutMutation();
  const importExercise = useImportCustomExerciseMutation();

  const [importedPlanIds, setImportedPlanIds] = useState<Set<number>>(
    new Set(),
  );
  const [importedWorkoutIds, setImportedWorkoutIds] = useState<Set<number>>(
    new Set(),
  );
  const [importedExerciseIds, setImportedExerciseIds] = useState<Set<number>>(
    new Set(),
  );

  if (!user) return null;

  const sharedCount = plans.length + workouts.length + exercises.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Profile header */}
      <View
        style={[
          styles.profileHeader,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.accentBorder,
          },
        ]}
      >
        {friend?.photoURL ? (
          <Avatar.Image size={64} source={{ uri: friend.photoURL }} />
        ) : (
          <Avatar.Text
            size={64}
            label={(friend?.displayName ?? "?").charAt(0).toUpperCase()}
          />
        )}
        <View style={styles.profileInfo}>
          <AppText variant="title" style={{ color: colors.contentPrimary }}>
            {friend?.displayName ?? friendUid}
          </AppText>
          {friend && (
            <AppText
              variant="caption"
              style={{ color: colors.contentSecondary, marginTop: 2 }}
            >
              <Trans>
                Friends since{" "}
                {friend.since.toDate().toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                })}
              </Trans>
            </AppText>
          )}
          <View style={styles.statChips}>
            <StatChip
              value={strength.length}
              label={<Trans>PRs</Trans>}
              colors={colors}
            />
            <StatChip
              value={completedWorkouts.length}
              label={<Trans>Workouts</Trans>}
              colors={colors}
            />
            <StatChip
              value={sharedCount}
              label={<Trans>Shared</Trans>}
              colors={colors}
            />
          </View>
        </View>
      </View>

      {/* Strength PRs */}
      <ZoneLabel
        title={<Trans>Strength PRs</Trans>}
        colors={colors}
        borders={borders}
      />
      {strengthLoading ? (
        <ActivityIndicator style={styles.sectionSpinner} />
      ) : strength.length === 0 ? (
        <EmptyState
          label={<Trans>No strength data shared yet</Trans>}
          colors={colors}
        />
      ) : (
        <View style={styles.cardGroup}>
          {strength.map((pr) => (
            <View
              key={`${pr.appExerciseId ?? "c"}_${pr.exerciseName}`}
              style={[styles.card, { backgroundColor: colors.card }]}
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  {pr.exerciseName}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  {formatDistanceToNow(pr.allTimePRDate.toDate(), {
                    addSuffix: true,
                  })}
                </AppText>
              </View>
              <View
                style={[
                  styles.prBadge,
                  {
                    backgroundColor: colors.accentSubtle,
                    borderColor: colors.accentBorder,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{ color: colors.accent, fontWeight: "700" }}
                >
                  {formatPR(pr, weightUnit)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Plans */}
      <ZoneLabel
        title={<Trans>Plans</Trans>}
        colors={colors}
        borders={borders}
      />
      {plansLoading ? (
        <ActivityIndicator style={styles.sectionSpinner} />
      ) : plans.length === 0 ? (
        <EmptyState
          label={<Trans>No plans shared yet</Trans>}
          colors={colors}
        />
      ) : (
        <View style={styles.cardGroup}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.localPlanId}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() =>
                router.push({
                  pathname: "/(app)/friend-plan",
                  params: { friendUid, planId: String(plan.localPlanId) },
                } as unknown as Parameters<typeof router.push>[0])
              }
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  {plan.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  <Trans>
                    Updated{" "}
                    {formatDistanceToNow(plan.updatedAt.toDate(), {
                      addSuffix: true,
                    })}
                  </Trans>
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  importPlan.mutate(plan, {
                    onSuccess: () =>
                      setImportedPlanIds((s) =>
                        new Set(s).add(plan.localPlanId),
                      ),
                  });
                }}
                disabled={
                  importedPlanIds.has(plan.localPlanId) || importPlan.isPending
                }
                style={styles.addButton}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: importedPlanIds.has(plan.localPlanId)
                      ? colors.contentSecondary
                      : colors.accent,
                    fontWeight: "600",
                  }}
                >
                  {importedPlanIds.has(plan.localPlanId) ? (
                    <Trans>Added</Trans>
                  ) : (
                    <Trans>Add</Trans>
                  )}
                </AppText>
              </TouchableOpacity>
              <AppIcon
                set="ion"
                name="chevron-forward"
                size={14}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Standalone Workouts */}
      <ZoneLabel
        title={<Trans>Standalone Workouts</Trans>}
        colors={colors}
        borders={borders}
      />
      {workoutsLoading ? (
        <ActivityIndicator style={styles.sectionSpinner} />
      ) : workouts.length === 0 ? (
        <EmptyState
          label={<Trans>No workouts shared yet</Trans>}
          colors={colors}
        />
      ) : (
        <View style={styles.cardGroup}>
          {workouts.map((workout) => (
            <TouchableOpacity
              key={workout.localWorkoutId}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() =>
                router.push({
                  pathname: "/(app)/friend-workout",
                  params: {
                    friendUid,
                    workoutId: String(workout.localWorkoutId),
                  },
                } as unknown as Parameters<typeof router.push>[0])
              }
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  {workout.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  <Trans>
                    Updated{" "}
                    {formatDistanceToNow(workout.updatedAt.toDate(), {
                      addSuffix: true,
                    })}
                  </Trans>
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  importWorkout.mutate(workout, {
                    onSuccess: () =>
                      setImportedWorkoutIds((s) =>
                        new Set(s).add(workout.localWorkoutId),
                      ),
                  });
                }}
                disabled={
                  importedWorkoutIds.has(workout.localWorkoutId) ||
                  importWorkout.isPending
                }
                style={styles.addButton}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: importedWorkoutIds.has(workout.localWorkoutId)
                      ? colors.contentSecondary
                      : colors.accent,
                    fontWeight: "600",
                  }}
                >
                  {importedWorkoutIds.has(workout.localWorkoutId) ? (
                    <Trans>Added</Trans>
                  ) : (
                    <Trans>Add</Trans>
                  )}
                </AppText>
              </TouchableOpacity>
              <AppIcon
                set="ion"
                name="chevron-forward"
                size={14}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Custom Exercises */}
      <ZoneLabel
        title={<Trans>Custom Exercises</Trans>}
        colors={colors}
        borders={borders}
      />
      {exercisesLoading ? (
        <ActivityIndicator style={styles.sectionSpinner} />
      ) : exercises.length === 0 ? (
        <EmptyState
          label={<Trans>No custom exercises shared yet</Trans>}
          colors={colors}
        />
      ) : (
        <View style={styles.cardGroup}>
          {exercises.map((exercise) => (
            <TouchableOpacity
              key={exercise.localExerciseId}
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() =>
                router.push({
                  pathname: "/(app)/friend-exercise",
                  params: {
                    friendUid,
                    exerciseId: String(exercise.localExerciseId),
                  },
                } as unknown as Parameters<typeof router.push>[0])
              }
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  {exercise.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  {exercise.equipment} · {exercise.targetMuscle}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  importExercise.mutate(exercise, {
                    onSuccess: () =>
                      setImportedExerciseIds((s) =>
                        new Set(s).add(exercise.localExerciseId),
                      ),
                  });
                }}
                disabled={
                  importedExerciseIds.has(exercise.localExerciseId) ||
                  importExercise.isPending
                }
                style={styles.addButton}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: importedExerciseIds.has(exercise.localExerciseId)
                      ? colors.contentSecondary
                      : colors.accent,
                    fontWeight: "600",
                  }}
                >
                  {importedExerciseIds.has(exercise.localExerciseId) ? (
                    <Trans>Added</Trans>
                  ) : (
                    <Trans>Add</Trans>
                  )}
                </AppText>
              </TouchableOpacity>
              <AppIcon
                set="ion"
                name="chevron-forward"
                size={14}
                color={colors.contentSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Activity */}
      <ZoneLabel
        title={<Trans>Activity</Trans>}
        colors={colors}
        borders={borders}
      />
      {completedLoading || measurementsLoading ? (
        <ActivityIndicator style={styles.sectionSpinner} />
      ) : completedWorkouts.length === 0 && measurements.length === 0 ? (
        <EmptyState
          label={<Trans>No activity shared yet</Trans>}
          colors={colors}
        />
      ) : (
        <View style={styles.cardGroup}>
          {completedWorkouts.slice(0, 10).map((w) => (
            <View
              key={w.localWorkoutId}
              style={[styles.card, { backgroundColor: colors.card }]}
            >
              <AppIcon
                set="ion"
                name="barbell-outline"
                size={16}
                color={colors.contentSecondary}
                style={{ marginRight: 4 }}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  {w.workoutName}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  {w.planName} ·{" "}
                  {formatDistanceToNow(w.dateCompleted.toDate(), {
                    addSuffix: true,
                  })}
                </AppText>
              </View>
            </View>
          ))}
          {measurements.slice(0, 5).map((m) => (
            <View
              key={m.localEntryId}
              style={[styles.card, { backgroundColor: colors.card }]}
            >
              <AppIcon
                set="ion"
                name="body-outline"
                size={16}
                color={colors.contentSecondary}
                style={{ marginRight: 4 }}
              />
              <View style={{ flex: 1 }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: colors.contentPrimary }}
                >
                  <Trans>Measurements</Trans>
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary, marginTop: 2 }}
                >
                  {Object.keys(m.values).length > 0
                    ? formatMeasurementSummary(m.values)
                    : formatDistanceToNow(m.recordedAt.toDate(), {
                        addSuffix: true,
                      })}
                </AppText>
              </View>
              <AppText
                variant="caption"
                style={{ color: colors.contentSecondary }}
              >
                {formatDistanceToNow(m.recordedAt.toDate(), {
                  addSuffix: true,
                })}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ZoneLabel({
  title,
  colors,
  borders,
}: {
  title: React.ReactNode;
  colors: AppThemeColors;
  borders: AppThemeBorders;
}) {
  return (
    <View style={styles.zoneLabel}>
      <AppText
        variant="caption"
        style={{
          color: colors.contentSecondary,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          fontWeight: "700",
        }}
      >
        {title}
      </AppText>
      <View style={[styles.zoneLine, { backgroundColor: borders.divider }]} />
    </View>
  );
}

function StatChip({
  value,
  label,
  colors,
}: {
  value: number;
  label: React.ReactNode;
  colors: AppThemeColors;
}) {
  return (
    <View
      style={[
        styles.statChip,
        {
          backgroundColor: colors.accentSubtle,
          borderColor: colors.accentBorder,
        },
      ]}
    >
      <AppText
        variant="bodyBold"
        style={{ color: colors.accent, fontSize: 15 }}
      >
        {value}
      </AppText>
      <AppText variant="caption" style={{ color: colors.contentSecondary }}>
        {label}
      </AppText>
    </View>
  );
}

function EmptyState({
  label,
  colors,
}: {
  label: React.ReactNode;
  colors: AppThemeColors;
}) {
  return (
    <View style={styles.emptyState}>
      <AppText variant="caption" style={{ color: colors.contentSecondary }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
    borderBottomWidth: 2,
  },
  profileInfo: {
    flex: 1,
  },
  statChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  statChip: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  zoneLabel: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 6,
    gap: 8,
  },
  zoneLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  cardGroup: {
    paddingHorizontal: 12,
    gap: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  prBadge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sectionSpinner: {
    marginVertical: 16,
  },
  emptyState: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
