import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { router } from "expo-router";
import {
  deleteCompletedWorkout,
  restoreCompletedWorkout,
} from "@/utils/database";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { showSnackbar } from "@/store/snackbarStore";
import { t } from "@lingui/core/macro";
import { refreshProgressionAfterHistoryChange } from "@/utils/progressionRecompute";

const UNDO_WINDOW_MS = 5000;

export const useDeleteCompletedWorkoutMutation = () => {
  const queryClient = useQueryClient();

  const invalidateHistory = () => {
    queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
    queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
    queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
  };

  const undoDelete = async (id: number) => {
    try {
      await restoreCompletedWorkout(id);
      invalidateHistory();
      void refreshProgressionAfterHistoryChange(queryClient, id);
    } catch (error) {
      notifyBugsnag(error);
      showSnackbar(t`Couldn't restore the workout.`);
    }
  };

  return useMutation({
    mutationFn: (id: number) => deleteCompletedWorkout(id),
    // Deletion is a soft delete, so it happens straight away and Undo just
    // clears the flag again.
    onSuccess: (_data, id) => {
      invalidateHistory();
      // The deleted session may be the one a pending suggestion was built on.
      void refreshProgressionAfterHistoryChange(queryClient, id);
      router.back();
      showSnackbar(t`Workout deleted`, {
        duration: UNDO_WINDOW_MS,
        action: { label: t`Undo`, onPress: () => void undoDelete(id) },
      });
    },
    onError: (error: any) => {
      console.error("Error deleting workout:", error);
      notifyBugsnag(error);
      Alert.alert(t`Error`, t`Failed to delete the workout. Please try again.`);
    },
  });
};
