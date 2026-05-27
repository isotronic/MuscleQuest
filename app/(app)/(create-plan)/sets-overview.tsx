import { useState, useMemo } from "react";
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  View,
  Switch,
} from "react-native";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Button, Divider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useWorkoutStore, Set } from "@/store/workoutStore";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { EditSetModal } from "@/components/EditSetModal";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { formatFromTotalSeconds } from "@/utils/utility";
import { resolvedTrackingType } from "@/utils/resolvedTrackingType";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export default function SetsOverviewScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { exerciseId, workoutIndex, trackingType } = useLocalSearchParams();
  const workouts = useWorkoutStore((state) => state.workouts);

  const { data: settings } = useSettingsQuery();

  const totalSeconds = settings ? parseInt(settings?.defaultRestTime) : 0;
  const distanceUnit = settings?.distanceUnit || "m";
  const defaultRepsMin = 8;
  const defaultRepsMax = 12;
  const defaultTime = 60;
  const defaultDistance = 0;
  const defaultTotalSeconds = totalSeconds;

  const currentWorkout = workouts[Number(workoutIndex)];
  const exercise = currentWorkout?.exercises.find(
    (ex) => ex.exercise_id === Number(exerciseId),
  );

  const supersetPartner = exercise?.supersetGroupId
    ? currentWorkout?.exercises.find(
        (ex) =>
          ex.exercise_id !== Number(exerciseId) &&
          ex.supersetGroupId === exercise.supersetGroupId,
      )
    : null;

  const sets = exercise?.sets || [];
  const effectiveTrackingType = exercise
    ? resolvedTrackingType(exercise)
    : trackingType?.toString() || "weight";
  const isBodyweightExercise = exercise?.tracking_type === "reps";
  const isWeightedOverride = exercise?.tracking_type_override === "weight";

  const handleToggleWeighted = () => {
    useWorkoutStore
      .getState()
      .setExerciseTrackingTypeOverride(
        Number(workoutIndex),
        Number(exerciseId),
        isWeightedOverride ? undefined : "weight",
      );
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);

  const handleAddSet = () => {
    setSelectedSetIndex(null);
    setModalVisible(true);
  };

  const handleEditSet = (index: number) => {
    setSelectedSetIndex(index);
    setModalVisible(true);
  };

  const handleDeleteSet = (index: number) => {
    useWorkoutStore
      .getState()
      .removeSetFromExercise(Number(workoutIndex), Number(exerciseId), index);
  };

  const handleAddWarmupSet = () => {
    let insertIndex = 0;
    for (let i = sets.length - 1; i >= 0; i--) {
      if (sets[i].isWarmup) {
        insertIndex = i + 1;
        break;
      }
    }
    const lastWarmupSet = sets.filter((s) => s.isWarmup).at(-1);
    const newSet: Set = lastWarmupSet
      ? {
          ...lastWarmupSet,
          isWarmup: true,
          isDropSet: false,
          isToFailure: false,
        }
      : {
          repsMin: defaultRepsMin,
          repsMax: defaultRepsMax,
          restMinutes: Math.floor(defaultTotalSeconds / 60),
          restSeconds: defaultTotalSeconds % 60,
          time: defaultTime,
          distance: undefined,
          isWarmup: true,
          isDropSet: false,
          isToFailure: false,
        };
    useWorkoutStore
      .getState()
      .insertSetAtExercise(
        Number(workoutIndex),
        Number(exerciseId),
        insertIndex,
        newSet,
      );
  };

  const renderSetItem = ({ item, index }: { item: Set; index: number }) => {
    const repRange =
      item.repsMin === item.repsMax
        ? item.repsMin
        : !item.repsMin
          ? item.repsMax
          : item.repsMax
            ? `${item.repsMin} - ${item.repsMax}`
            : item.repsMin;

    const formattedTime = item.time
      ? formatFromTotalSeconds(item.time)
      : formatFromTotalSeconds(defaultTime);

    const previousSet = index > 0 ? sets[index - 1] : null;
    const showGroupDivider =
      previousSet !== null &&
      (previousSet.isWarmup ?? false) !== (item.isWarmup ?? false);

    return (
      <>
        {showGroupDivider && <Divider style={styles.groupDivider} />}
        <ThemedView
          style={[styles.setItem, item.isWarmup && styles.warmupSetItem]}
        >
          <TouchableOpacity
            onPress={() => handleEditSet(index)}
            style={styles.setContent}
          >
            <ThemedView style={styles.setTextContainer}>
              <ThemedText style={styles.setTitle}>
                <Trans>Set {index + 1}</Trans>
              </ThemedText>
              <ThemedText style={styles.setInfo}>
                {item.isWarmup ? t`Warm-up, ` : ""}
                {item.isDropSet ? t`Drop set, ` : ""}
                {item.isToFailure ? t`To failure, ` : ""}
                {effectiveTrackingType === "time"
                  ? `${formattedTime}, `
                  : effectiveTrackingType === "distance"
                    ? item.distance !== undefined
                      ? `${item.distance} ${distanceUnit}, `
                      : ""
                    : repRange !== undefined
                      ? t`${repRange} Reps, `
                      : ""}
                {item.restMinutes}:{String(item.restSeconds).padStart(2, "0")}{" "}
                <Trans>Rest</Trans>
              </ThemedText>
            </ThemedView>
          </TouchableOpacity>
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={colors.contentPrimary}
            onPress={() => handleDeleteSet(index)}
            style={styles.deleteIcon}
          />
        </ThemedView>
      </>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: exercise?.name,
          headerRight: () => (
            <Button
              labelStyle={styles.buttonLabel}
              onPress={() =>
                router.push(`/(app)/exercise-info?exercise_id=${exerciseId}`)
              }
            >
              <Trans>Details</Trans>
            </Button>
          ),
        }}
      />
      {supersetPartner && (
        <View style={styles.supersetBanner}>
          <ThemedText style={styles.supersetBannerLabel}>
            <Trans>Superset</Trans>
          </ThemedText>
          <ThemedText style={styles.supersetBannerPartner}>
            <Trans>Paired with {supersetPartner.name}</Trans>
          </ThemedText>
        </View>
      )}
      <FlatList
        data={sets}
        renderItem={renderSetItem}
        keyExtractor={(_: any, index: number) => index.toString()}
        contentContainerStyle={styles.flatListContent}
        style={styles.flatList}
      />
      {isBodyweightExercise && (
        <View style={styles.weightedToggleRow}>
          <View style={styles.weightedToggleLeft}>
            <MaterialCommunityIcons
              name="weight-kilogram"
              size={20}
              color={
                isWeightedOverride ? colors.accent : colors.contentSecondary
              }
              style={{ marginRight: 10 }}
            />
            <ThemedText style={styles.weightedToggleLabel}>
              <Trans>Track Weight</Trans>
            </ThemedText>
          </View>
          <Switch
            value={isWeightedOverride}
            onValueChange={handleToggleWeighted}
            trackColor={{
              false: colors.surface,
              true: colors.accent,
            }}
          />
        </View>
      )}
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          labelStyle={styles.buttonLabel}
          style={styles.addSetButton}
          onPress={handleAddWarmupSet}
        >
          <Trans>Add Warm-up</Trans>
        </Button>
        <Button
          mode="contained"
          labelStyle={styles.buttonLabel}
          style={styles.addSetButton}
          onPress={handleAddSet}
        >
          <Trans>Add Set</Trans>
        </Button>
      </View>
      <EditSetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        workoutIndex={Number(workoutIndex)}
        exerciseId={Number(exerciseId)}
        setIndex={selectedSetIndex}
        defaultRepsMin={defaultRepsMin}
        defaultRepsMax={defaultRepsMax}
        defaultTotalSeconds={defaultTotalSeconds}
        defaultTime={defaultTime}
        defaultDistance={defaultDistance}
        trackingType={effectiveTrackingType}
        distanceUnit={distanceUnit}
      />
    </ThemedView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
    },
    flatList: {
      flex: 1,
    },
    weightedToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 8,
      marginBottom: 12,
    },
    weightedToggleLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    weightedToggleLabel: {
      fontSize: 14,
      color: colors.contentPrimary,
    },
    supersetBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    supersetBannerLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    supersetBannerPartner: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    setItem: {
      backgroundColor: colors.card,
      padding: 16,
      marginBottom: 10,
      borderRadius: radii.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    warmupSetItem: {
      borderLeftWidth: 3,
      borderLeftColor: colors.badgeWarmup,
    },
    groupDivider: {
      marginBottom: 8,
      backgroundColor: colors.contentSecondary,
    },
    setContent: {
      flex: 1,
    },
    setTextContainer: {
      flex: 1,
      backgroundColor: colors.card,
    },
    setTitle: {
      fontSize: 18,
      color: colors.contentPrimary,
      fontWeight: "bold",
    },
    setInfo: {
      fontSize: 16,
      color: colors.contentPrimary,
      marginTop: 5,
    },
    deleteIcon: {
      paddingLeft: 16,
    },
    flatListContent: {
      paddingBottom: 8,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 8,
      paddingBottom: 16,
    },
    addSetButton: {
      flex: 1,
    },
    buttonLabel: {
      fontSize: 16,
    },
  });
}
