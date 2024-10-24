import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openDatabase } from "@/utils/database";

// Function to toggle favorite status in the database
const toggleFavoriteStatus = async (
  exerciseId: number,
  currentStatus: number,
) => {
  const db = await openDatabase("userData.db");
  const newStatus = currentStatus === 0 ? 1 : 0;

  await db.runAsync(`
    UPDATE exercises 
    SET favorite = ${newStatus} 
    WHERE exercise_id = ${exerciseId};
  `);
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
