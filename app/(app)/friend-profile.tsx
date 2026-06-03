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
import { formatDistanceToNow } from "date-fns";
import { AppText, AppIcon } from "@/components/ui";
import { useAppTheme } from "@/theme";
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
import { AppThemeColors } from "@/theme/types";

export default function FriendProfileScreen() {
  const { friendUid } = useLocalSearchParams<{ friendUid: string }>();
  const { colors, borders } = useAppTheme();
  const router = useRouter();
  const user = useContext(AuthContext);
  const { friends } = useSocialStore();

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

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    plans: true,
    workouts: true,
    exercises: true,
    completedWorkouts: false,
    measurements: false,
    strength: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!user) return null;

  const allLoading =
    plansLoading ||
    workoutsLoading ||
    exercisesLoading ||
    completedLoading ||
    measurementsLoading ||
    strengthLoading;
  const allEmpty =
    !allLoading &&
    plans.length === 0 &&
    workouts.length === 0 &&
    exercises.length === 0 &&
    completedWorkouts.length === 0 &&
    measurements.length === 0 &&
    strength.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        {friend?.photoURL ? (
          <Avatar.Image size={72} source={{ uri: friend.photoURL }} />
        ) : (
          <Avatar.Text
            size={72}
            label={(friend?.displayName ?? "?").charAt(0).toUpperCase()}
          />
        )}
        <AppText
          variant="title"
          style={{ marginTop: 12, color: colors.contentPrimary }}
        >
          {friend?.displayName ?? friendUid}
        </AppText>
        {friend && (
          <AppText
            variant="caption"
            style={{ color: colors.contentSecondary, marginTop: 4 }}
          >
            <Trans>
              Friends since{" "}
              {friend.since.toDate().toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Trans>
          </AppText>
        )}
      </View>

      {allLoading && <ActivityIndicator style={{ marginTop: 32 }} />}

      {allEmpty && (
        <AppText
          variant="body"
          style={{
            color: colors.contentSecondary,
            textAlign: "center",
            marginTop: 32,
          }}
        >
          <Trans>This friend hasn't shared any content yet.</Trans>
        </AppText>
      )}

      {/* Plans */}
      <SectionHeader
        title={<Trans>Plans</Trans>}
        expanded={expandedSections.plans}
        onToggle={() => toggleSection("plans")}
        colors={colors}
      />
      {expandedSections.plans &&
        (plansLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : plans.length === 0 ? (
          <EmptyState
            label={<Trans>No plans shared yet</Trans>}
            colors={colors}
          />
        ) : (
          plans.map((plan) => (
            <TouchableOpacity
              key={plan.localPlanId}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/(app)/friend-plan",
                  params: { friendUid, planId: String(plan.localPlanId) },
                } as unknown as Parameters<typeof router.push>[0])
              }
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {plan.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
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
          ))
        ))}

      {/* Standalone Workouts */}
      <SectionHeader
        title={<Trans>Standalone Workouts</Trans>}
        expanded={expandedSections.workouts}
        onToggle={() => toggleSection("workouts")}
        colors={colors}
      />
      {expandedSections.workouts &&
        (workoutsLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : workouts.length === 0 ? (
          <EmptyState
            label={<Trans>No workouts shared yet</Trans>}
            colors={colors}
          />
        ) : (
          workouts.map((workout) => (
            <TouchableOpacity
              key={workout.localWorkoutId}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
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
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {workout.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
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
          ))
        ))}

      {/* Custom Exercises */}
      <SectionHeader
        title={<Trans>Custom Exercises</Trans>}
        expanded={expandedSections.exercises}
        onToggle={() => toggleSection("exercises")}
        colors={colors}
      />
      {expandedSections.exercises &&
        (exercisesLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : exercises.length === 0 ? (
          <EmptyState
            label={<Trans>No custom exercises shared yet</Trans>}
            colors={colors}
          />
        ) : (
          exercises.map((exercise) => (
            <TouchableOpacity
              key={exercise.localExerciseId}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
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
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {exercise.name}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
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
          ))
        ))}

      {/* Recent Workouts — read-only */}
      <SectionHeader
        title={<Trans>Recent Workouts</Trans>}
        expanded={expandedSections.completedWorkouts}
        onToggle={() => toggleSection("completedWorkouts")}
        colors={colors}
      />
      {expandedSections.completedWorkouts &&
        (completedLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : completedWorkouts.length === 0 ? (
          <EmptyState
            label={<Trans>No completed workouts shared yet</Trans>}
            colors={colors}
          />
        ) : (
          completedWorkouts.slice(0, 10).map((w) => (
            <View
              key={w.localWorkoutId}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {w.workoutName}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
                >
                  {w.planName} ·{" "}
                  {formatDistanceToNow(w.dateCompleted.toDate(), {
                    addSuffix: true,
                  })}
                </AppText>
              </View>
            </View>
          ))
        ))}

      {/* Body Measurements — read-only */}
      <SectionHeader
        title={<Trans>Body Measurements</Trans>}
        expanded={expandedSections.measurements}
        onToggle={() => toggleSection("measurements")}
        colors={colors}
      />
      {expandedSections.measurements &&
        (measurementsLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : measurements.length === 0 ? (
          <EmptyState
            label={<Trans>No measurements shared yet</Trans>}
            colors={colors}
          />
        ) : (
          measurements.slice(0, 10).map((m) => (
            <View
              key={m.localEntryId}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
            >
              <AppText variant="body" style={{ color: colors.contentPrimary }}>
                {formatDistanceToNow(m.recordedAt.toDate(), {
                  addSuffix: true,
                })}
              </AppText>
            </View>
          ))
        ))}

      {/* Strength PRs — read-only */}
      <SectionHeader
        title={<Trans>Strength PRs</Trans>}
        expanded={expandedSections.strength}
        onToggle={() => toggleSection("strength")}
        colors={colors}
      />
      {expandedSections.strength &&
        (strengthLoading ? (
          <ActivityIndicator style={{ margin: 16 }} />
        ) : strength.length === 0 ? (
          <EmptyState
            label={<Trans>No strength data shared yet</Trans>}
            colors={colors}
          />
        ) : (
          strength.map((pr) => (
            <View
              key={`${pr.appExerciseId ?? "c"}_${pr.exerciseName}`}
              style={[
                styles.contentRow,
                { borderBottomColor: borders.divider },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {pr.exerciseName}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
                >
                  PR: {pr.allTimePR}
                </AppText>
              </View>
            </View>
          ))
        ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function SectionHeader({
  title,
  expanded,
  onToggle,
  colors,
}: {
  title: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  colors: AppThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: colors.card }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <AppText
        variant="label"
        style={{ color: colors.contentPrimary, flex: 1 }}
      >
        {title}
      </AppText>
      <AppIcon
        set="ion"
        name={expanded ? "chevron-up" : "chevron-down"}
        size={16}
        color={colors.contentSecondary}
      />
    </TouchableOpacity>
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
  container: { paddingBottom: 32 },
  header: { alignItems: "center", paddingVertical: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  addButton: { paddingHorizontal: 8, paddingVertical: 4 },
  emptyState: { paddingHorizontal: 16, paddingVertical: 12 },
});
