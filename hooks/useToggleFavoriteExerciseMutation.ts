import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import type { SQLiteDatabase } from "expo-sqlite";
import Bugsnag from "@bugsnag/expo";

// Function to toggle favorite status in the database
const toggleFavoriteStatus = async (
  exerciseId: number,
  currentStatus: number,
) => {
  let db: SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");
    const newStatus = currentStatus === 0 ? 1 : 0;

    await db.runAsync(
      `UPDATE exercises SET favorite = ? WHERE exercise_id = ?;`,
      [newStatus, exerciseId],
    );
  } catch (error: any) {
    console.error("Error toggling favorite status:", error);
    Bugsnag.notify(error);
    throw new Error(`Failed to toggle favorite status: ${error}`);
  } finally {
    if (db) {
      try {
        await db.closeAsync();
      } catch (closeError: any) {
        Bugsnag.notify(closeError);
      }
    }
  }
};

// Custom hook to toggle favorite status
export const useToggleFavoriteExerciseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      exerciseId,
      currentStatus,
    }: {
      exerciseId: number;
      currentStatus: number;
    }) => {
      return toggleFavoriteStatus(exerciseId, currentStatus);
    },
    onSuccess: (_, { exerciseId }) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({
        queryKey: ["exercise-info", exerciseId],
      });
    },
  });
};
