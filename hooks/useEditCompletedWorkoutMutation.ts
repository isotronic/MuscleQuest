import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CompletedWorkout } from "./useCompletedWorkoutsQuery";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { openDatabase } from "@/utils/database";
import type { SQLiteDatabase } from "expo-sqlite";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { displayToKg, displayToMetres, roundCanonical } from "@/utils/units";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";
import { syncCompletedWorkoutChanged } from "@/utils/sharedSync";

type EditedExercises = CompletedWorkout["exercises"];
type EditedSet = EditedExercises[number]["sets"][number];
type SetField = "weight" | "reps" | "time" | "distance";

export interface CompletedWorkoutEdit {
  /** The exercises as the edit screen loaded them, in display units. */
  original: EditedExercises;
  /** The same exercises after editing. */
  edited: EditedExercises;
}

const SET_FIELDS: SetField[] = ["weight", "reps", "time", "distance"];

/**
 * Converts one edited display value back to storage. Null stays null: a
 * missing weight is not a 0 kg set. Rounded so the same input always stores
 * the same value; see roundCanonical.
 */
const toStored = (
  field: SetField,
  value: number | null,
  weightUnit: string,
  distanceUnit: string,
): number | null => {
  if (value == null) return null;
  if (field === "weight") return roundCanonical(displayToKg(value, weightUnit));
  if (field === "distance")
    return roundCanonical(displayToMetres(value, distanceUnit));
  return value;
};

const findSet = (sets: EditedSet[] | undefined, set: EditedSet) =>
  sets?.find((s) => s.set_id === set.set_id && s.set_number === set.set_number);

/**
 * Writes only what the user changed. Untouched values went through a display
 * round trip (kg to lbs to one decimal and back), so writing them would
 * silently alter history.
 */
const saveEditedWorkout = async (
  { original, edited }: CompletedWorkoutEdit,
  weightUnit: string,
  distanceUnit: string,
) => {
  const originalById = new Map(
    original.map((exercise) => [exercise.completed_exercise_id, exercise]),
  );

  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const exercise of edited) {
        const before = originalById.get(exercise.completed_exercise_id);
        if (
          !before ||
          before.exercise_id !== exercise.exercise_id ||
          before.exercise_tracking_type !== exercise.exercise_tracking_type
        ) {
          await txn.runAsync(
            `UPDATE completed_exercises SET exercise_id = ?, resolved_tracking_type = ? WHERE id = ?`,
            [
              exercise.exercise_id,
              exercise.exercise_tracking_type,
              exercise.completed_exercise_id,
            ],
          );
        }
        for (const set of exercise.sets) {
          const previous = findSet(before?.sets, set);
          const changed = SET_FIELDS.filter(
            (field) =>
              !previous || (previous[field] ?? null) !== (set[field] ?? null),
          );
          if (changed.length === 0) continue;
          await txn.runAsync(
            `UPDATE completed_sets SET ${changed
              .map((field) => `${field} = ?`)
              .join(", ")} WHERE id = ? AND set_number = ?`,
            [
              ...changed.map((field) =>
                toStored(field, set[field] ?? null, weightUnit, distanceUnit),
              ),
              set.set_id,
              set.set_number,
            ],
          );
        }
      }
    });
  } catch (error: any) {
    console.error("Error saving edited workout:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const useEditCompletedWorkoutMutation = (
  id: number,
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (edit: CompletedWorkoutEdit) => {
      return await saveEditedWorkout(edit, weightUnit, distanceUnit);
    },
    onSuccess: (_data, edit) => {
      queryClient.invalidateQueries({ queryKey: ["completedWorkout", id] });
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      queryClient.invalidateQueries({ queryKey: ["workoutSessionHistory"] });
      queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession"],
      });
      // A pending suggestion may have been built on the values just corrected.
      void refreshProgressionAfterHistoryChange(queryClient, id);
      // Friends see the corrected values. The exercises from before the edit
      // are included because one swapped out may have lost its PR here.
      syncCompletedWorkoutChanged(
        id,
        edit.original.map((exercise) => exercise.exercise_id),
      );
    },
    onError: (error) => {
      console.error("Error saving edited workout:", error);
      notifyBugsnag(error);
      Alert.alert(
        t`Error`,
        t`An error occurred while saving your edited workout. Please try again.`,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["completedWorkout", id],
      });
      await queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      await queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
      await queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      await queryClient.invalidateQueries({
        queryKey: ["workoutSessionHistory"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession"],
      });
    },
  });
};
