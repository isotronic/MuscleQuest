import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";
import Bugsnag from "@bugsnag/expo";

// Function to toggle favorite status in the database
const toggleFavoriteStatus = async (
  exerciseId: number,
  currentStatus: number,
) => {
  try {
    const db = await openDatabase("userData.db");
    const newStatus = currentStatus === 0 ? 1 : 0;

    await db.runAsync(`
    UPDATE exercises 
    SET favorite = ${newStatus} 
    WHERE exercise_id = ${exerciseId};
  `);
  } catch (error: any) {
    console.error("Error toggling favorite status:", error);
    Bugsnag.notify(error);
    throw new Error(`Failed to toggle favorite status: ${error}`);
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
        queryKey: ["exercise-details", exerciseId],
      });
    },
  });
};
