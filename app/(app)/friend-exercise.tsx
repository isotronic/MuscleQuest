import React, { useState } from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { AppThemeColors, AppThemeBorders } from "@/theme/types";
import { useFriendSharedCustomExercisesQuery } from "@/hooks/useFriendSharedCustomExercisesQuery";
import { useImportCustomExerciseMutation } from "@/hooks/useImportCustomExerciseMutation";

export default function FriendExerciseScreen() {
  const { friendUid, exerciseId } = useLocalSearchParams<{
    friendUid: string;
    exerciseId: string;
  }>();
  const { colors, borders } = useAppTheme();

  const { data: exercises = [], isLoading } =
    useFriendSharedCustomExercisesQuery(friendUid);
  const exercise = exercises.find(
    (e) => String(e.localExerciseId) === exerciseId,
  );

  const importExercise = useImportCustomExerciseMutation();
  const [imported, setImported] = useState(false);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <AppText variant="body" style={{ color: colors.contentSecondary }}>
          <Trans>Exercise not found.</Trans>
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText
          variant="title"
          style={{ color: colors.contentPrimary, marginBottom: 24 }}
        >
          {exercise.name}
        </AppText>

        <InfoRow
          label={<Trans>Equipment</Trans>}
          value={exercise.equipment}
          colors={colors}
          borders={borders}
        />
        <InfoRow
          label={<Trans>Body Part</Trans>}
          value={exercise.bodyPart}
          colors={colors}
          borders={borders}
        />
        <InfoRow
          label={<Trans>Target Muscle</Trans>}
          value={exercise.targetMuscle}
          colors={colors}
          borders={borders}
        />
        {exercise.secondaryMuscles.length > 0 && (
          <InfoRow
            label={<Trans>Secondary Muscles</Trans>}
            value={exercise.secondaryMuscles.join(", ")}
            colors={colors}
            borders={borders}
          />
        )}
        <InfoRow
          label={<Trans>Tracking Type</Trans>}
          value={exercise.trackingType}
          colors={colors}
          borders={borders}
        />
        {exercise.isUnilateral && (
          <InfoRow
            label={<Trans>Unilateral</Trans>}
            value="Yes"
            colors={colors}
            borders={borders}
          />
        )}
        {exercise.description && (
          <View style={{ marginTop: 16 }}>
            <AppText
              variant="caption"
              style={{ color: colors.contentSecondary, marginBottom: 4 }}
            >
              <Trans>Description</Trans>
            </AppText>
            <AppText variant="body" style={{ color: colors.contentPrimary }}>
              {exercise.description}
            </AppText>
          </View>
        )}

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
              opacity: importExercise.isPending ? 0.7 : 1,
            },
          ]}
          onPress={() =>
            importExercise.mutate(exercise, {
              onSuccess: () => setImported(true),
              onError: () =>
                Alert.alert(
                  t`Import failed`,
                  t`Could not add this exercise. Please try again.`,
                ),
            })
          }
          disabled={imported || importExercise.isPending}
        >
          {importExercise.isPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <AppText
              variant="bodyBold"
              style={{
                color: imported ? colors.contentSecondary : colors.onAccent,
              }}
            >
              {imported ? (
                <Trans>Added to my exercises</Trans>
              ) : (
                <Trans>Add to my exercises</Trans>
              )}
            </AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
  borders,
}: {
  label: React.ReactNode;
  value: string;
  colors: AppThemeColors;
  borders: AppThemeBorders;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: borders.divider }]}>
      <AppText
        variant="caption"
        style={{ color: colors.contentSecondary, width: 140 }}
      >
        {label}
      </AppText>
      <AppText variant="body" style={{ color: colors.contentPrimary, flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
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
