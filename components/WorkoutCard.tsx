import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, TextInput, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useWorkoutStore, Workout, UserExercise } from "@/store/workoutStore";
import { Card, Button, Menu, IconButton } from "react-native-paper";
import { Trans, Plural } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import Sortable from "react-native-sortables";
import type { SortableGridRenderItem } from "react-native-sortables";
import { formatFromTotalSeconds } from "@/utils/utility";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useWorkoutDurationEstimate } from "@/hooks/useWorkoutDurationEstimate";
import { formatDurationEstimate } from "@/utils/estimateWorkoutDuration";

// Each item fed to Sortable.Grid is either a solo exercise or an adjacent superset pair.
// The pair is treated as a single draggable unit so both exercises move together.
type SingleItem = {
  type: "single";
  exercise: UserExercise;
  exerciseIndex: number;
};

type SupersetItem = {
  type: "superset";
  exercises: [UserExercise, UserExercise];
  exerciseIndices: [number, number];
};

type GroupedItem = SingleItem | SupersetItem;

interface WorkoutCardProps {
  workout: Workout;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isStandalone?: boolean;
  onRemove: (index: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onNameChange: (index: number, name: string) => void;
  onAddExercise: (index: number) => void;
}

export default function WorkoutCard({
  workout,
  index,
  isFirst,
  isLast,
  isStandalone = false,
  onRemove,
  onMoveUp,
  onMoveDown,
  onNameChange,
  onAddExercise,
}: WorkoutCardProps) {
  const { workouts } = useWorkoutStore();
  const { data: settings } = useSettingsQuery();
  const distanceUnit = settings?.distanceUnit || "m";
  const countUnilateralDouble = settings?.countUnilateralDouble === "true";
  const [menuVisible, setMenuVisible] = useState<number | null>(null);
  const { estimate } = useWorkoutDurationEstimate(
    workout.exercises,
    countUnilateralDouble,
  );

  const openMenu = (exerciseId: number) => setMenuVisible(exerciseId);
  const closeMenu = () => setMenuVisible(null);

  const workoutIndex = index;

  const removeExercise = useCallback(
    (exerciseId: number) => {
      const exercise = workout.exercises.find(
        (ex) => ex.exercise_id === exerciseId,
      );
      if (!exercise) return;
      Alert.alert(
        t`Remove Exercise`,
        t`Are you sure you want to remove ${exercise.name}?`,
        [
          { text: t`Cancel`, style: "cancel" },
          {
            text: t`Remove`,
            style: "destructive",
            onPress: () => {
              useWorkoutStore
                .getState()
                .removeExercise(workoutIndex, exerciseId);
            },
          },
        ],
      );
    },
    [workout.exercises, workoutIndex],
  );

  const handleReplace = useCallback(
    (exerciseIndex: number) => {
      const exercise = workout.exercises[exerciseIndex];
      router.push({
        pathname: "/(app)/(create-plan)/exercises",
        params: {
          index: workoutIndex,
          replaceExerciseIndex: exerciseIndex,
          targetMuscle: exercise?.target_muscle || undefined,
        },
      });
    },
    [workoutIndex, workout.exercises],
  );

  const handleCreateSuperset = useCallback(
    (exerciseIndex: number) => {
      router.push({
        pathname: "/(app)/(create-plan)/exercises",
        params: {
          index: workoutIndex,
          supersetForIndex: exerciseIndex,
        },
      });
    },
    [workoutIndex],
  );

  const handleRemoveSuperset = useCallback(
    (exerciseIndex: number) => {
      useWorkoutStore
        .getState()
        .removeFromSuperset(workoutIndex, exerciseIndex);
    },
    [workoutIndex],
  );

  // Build the grouped data array. Superset pairs become one item so they drag together.
  const groupedData = useMemo((): GroupedItem[] => {
    const result: GroupedItem[] = [];
    const seen = new Set<number>();

    workout.exercises.forEach((exercise, i) => {
      if (seen.has(exercise.exercise_id)) return;
      seen.add(exercise.exercise_id);

      const { supersetGroupId } = exercise;
      if (supersetGroupId) {
        const partnerIdx = workout.exercises.findIndex(
          (e, j) => j !== i && e.supersetGroupId === supersetGroupId,
        );
        const partner =
          partnerIdx !== -1 ? workout.exercises[partnerIdx] : null;
        if (partner && !seen.has(partner.exercise_id)) {
          seen.add(partner.exercise_id);
          result.push({
            type: "superset",
            exercises: [exercise, partner],
            exerciseIndices: [i, partnerIdx],
          });
          return;
        }
      }
      result.push({ type: "single", exercise, exerciseIndex: i });
    });

    return result;
  }, [workout.exercises]);

  // Renders a single exercise row. Used for both solo exercises and each half of a superset.
  const renderExerciseRow = useCallback(
    (
      item: UserExercise,
      exerciseIndex: number,
      isFirstInSuperset: boolean,
      isSecondInSuperset: boolean,
    ) => {
      const isInSuperset = isFirstInSuperset || isSecondInSuperset;

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
      const maxTime = Math.max(
        ...item.sets.map((set) => set.time ?? -Infinity),
      );

      let timeRange;
      if (minTime === Infinity && maxTime !== -Infinity) {
        timeRange = formatFromTotalSeconds(maxTime);
      } else if (maxTime === -Infinity && minTime !== Infinity) {
        timeRange = formatFromTotalSeconds(minTime);
      } else if (minTime === maxTime) {
        timeRange = formatFromTotalSeconds(minTime);
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
      const isMenuOpen = menuVisible === item.exercise_id;

      return (
        <View
          key={item.exercise_id}
          style={[
            styles.exerciseItem,
            isInSuperset && styles.supersetExerciseItem,
            isFirstInSuperset && styles.supersetExerciseFirst,
            isSecondInSuperset && styles.supersetExerciseLast,
          ]}
        >
          <Sortable.Touchable
            onTap={() =>
              router.push(
                `/sets-overview?exerciseId=${item.exercise_id}&workoutIndex=${workoutIndex}&exerciseIndex=${exerciseIndex}&trackingType=${item.tracking_type}`,
              )
            }
            style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          >
            <MaterialCommunityIcons
              name="drag"
              size={24}
              color="#ECEFF4"
              style={styles.dragIcon}
            />
            <View style={styles.exerciseInfo}>
              <ThemedText style={styles.exerciseName}>{item.name}</ThemedText>
              <ThemedText style={styles.setsAndReps}>
                {item?.sets?.length
                  ? <Plural value={item.sets.length} one="# Set" other="# Sets" />
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
          </Sortable.Touchable>
          <Menu
            visible={isMenuOpen}
            onDismiss={closeMenu}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => openMenu(item.exercise_id)}
                iconColor={Colors.dark.text}
              />
            }
          >
            <Menu.Item
              onPress={() => {
                closeMenu();
                removeExercise(item.exercise_id);
              }}
              title={t`Delete`}
            />
            <Menu.Item
              onPress={() => {
                closeMenu();
                handleReplace(exerciseIndex);
              }}
              title={t`Replace`}
            />
            {isInSuperset ? (
              <Menu.Item
                onPress={() => {
                  closeMenu();
                  handleRemoveSuperset(exerciseIndex);
                }}
                title={t`Remove Superset`}
              />
            ) : (
              <Menu.Item
                onPress={() => {
                  closeMenu();
                  handleCreateSuperset(exerciseIndex);
                }}
                title={t`Create Superset`}
              />
            )}
            <Menu.Item
              onPress={() => {
                closeMenu();
                router.push(
                  `/(app)/exercise-info?exercise_id=${item.exercise_id}`,
                );
              }}
              title={t`View Details`}
            />
          </Menu>
        </View>
      );
    },
    [
      handleCreateSuperset,
      handleRemoveSuperset,
      handleReplace,
      menuVisible,
      removeExercise,
      workoutIndex,
      distanceUnit,
    ],
  );

  // Renders each Sortable.Grid item — either a solo row or a superset pair block.
  const renderItem: SortableGridRenderItem<GroupedItem> = useCallback(
    ({ item }) => {
      if (item.type === "single") {
        return (
          <View>
            {renderExerciseRow(item.exercise, item.exerciseIndex, false, false)}
          </View>
        );
      }
      const [exA, exB] = item.exercises;
      const [idxA, idxB] = item.exerciseIndices;
      return (
        <View>
          <View style={styles.supersetHeader}>
            <ThemedText style={styles.supersetHeaderText}>
              <Trans>Superset</Trans>
            </ThemedText>
          </View>
          {renderExerciseRow(exA, idxA, true, false)}
          <View style={styles.supersetConnector} />
          {renderExerciseRow(exB, idxB, false, true)}
        </View>
      );
    },
    [renderExerciseRow],
  );

  // Reorder groups then flatten back to the flat exercises array.
  const handleOrderChange = useCallback(
    ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
      if (fromIndex === toIndex) return;
      const reordered = [...groupedData];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      const updatedExercises = reordered.flatMap((item) =>
        item.type === "single" ? [item.exercise] : item.exercises,
      );

      const updatedWorkouts = workouts.map((w, i) =>
        i === index ? { ...w, exercises: updatedExercises } : w,
      );

      useWorkoutStore.setState({ workouts: updatedWorkouts });
    },
    [groupedData, workouts, index],
  );

  return (
    <Card style={styles.workoutCard}>
      {!isStandalone && (
        <View style={styles.workoutHeader}>
          <ThemedText style={styles.workoutDay}>
            <Trans>Workout {index + 1}</Trans>
          </ThemedText>
          <View style={styles.workoutHeaderActions}>
            <MaterialCommunityIcons
              name="chevron-up"
              onPress={isFirst ? undefined : onMoveUp}
              size={24}
              color={isFirst ? Colors.dark.subText : Colors.dark.text}
            />
            <MaterialCommunityIcons
              name="chevron-down"
              onPress={isLast ? undefined : onMoveDown}
              size={24}
              color={isLast ? Colors.dark.subText : Colors.dark.text}
            />
            <MaterialCommunityIcons
              name="close"
              onPress={() => onRemove(index)}
              size={24}
              color={Colors.dark.text}
              style={styles.removeWorkoutButton}
            />
          </View>
        </View>
      )}
      <TextInput
        placeholder={t`Workout name`}
        placeholderTextColor={Colors.dark.subText}
        style={styles.input}
        value={workout.name}
        onChangeText={(text: string) => onNameChange(index, text)}
      />
      {workout.exercises.length > 0 && estimate != null && (
        <ThemedText style={styles.durationEstimate}>
          <Trans>Estimated Duration: {formatDurationEstimate(estimate)}</Trans>
        </ThemedText>
      )}
      {workout.exercises.length > 0 ? (
        <Sortable.Grid
          columns={1}
          data={groupedData}
          keyExtractor={(item) =>
            item.type === "single"
              ? item.exercise.exercise_id.toString()
              : `ss-${item.exercises[0].exercise_id}-${item.exercises[1].exercise_id}`
          }
          renderItem={renderItem}
          onDragEnd={handleOrderChange}
          showDropIndicator
        />
      ) : (
        <ThemedText style={styles.emptyText}>
          <Trans>No exercises added yet</Trans>
        </ThemedText>
      )}
      <Button
        mode="outlined"
        style={styles.addButton}
        onPress={() => onAddExercise(index)}
      >
        <Trans>Add Exercise</Trans>
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    overflow: "visible",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: 10,
    borderColor: Colors.dark.subText,
    borderWidth: 1,
    borderRadius: 8,
    color: Colors.dark.text,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 18,
    height: 40,
  },
  durationEstimate: {
    fontSize: 13,
    color: Colors.dark.subText,
    marginTop: 4,
    marginBottom: 4,
  },
  addButton: {
    marginTop: 8,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 10,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  workoutCard: {
    width: "100%",
    backgroundColor: Colors.dark.cardBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "visible",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workoutHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  workoutDay: {
    fontSize: 16,
  },
  workoutName: {
    fontSize: 18,
    color: Colors.dark.text,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 15,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: Colors.dark.cardBackground2,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "visible",
  },
  activeExerciseItem: {
    backgroundColor: Colors.dark.activeCardBackground,
    zIndex: 9999,
  },
  exerciseName: {
    color: "#ECEFF4",
    fontSize: 16,
  },
  removeWorkoutButton: {
    padding: 4,
    borderRadius: 50,
  },
  dragIcon: {
    marginRight: 10,
  },
  exerciseInfo: {
    flex: 1,
  },
  setsAndReps: {
    fontSize: 14,
    color: "#D8DEE9",
  },
  closeIcon: {
    marginLeft: "auto",
  },
  supersetHeader: {
    paddingHorizontal: 4,
    paddingBottom: 0,
    marginTop: -7,
  },
  supersetHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.dark.tint,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  supersetConnector: {
    width: 3,
    height: 6,
    backgroundColor: Colors.dark.tint,
    marginLeft: 27,
  },
  supersetExerciseItem: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.tint,
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
