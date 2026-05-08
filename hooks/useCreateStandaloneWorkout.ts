import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createStandaloneWorkout,
  updateStandaloneWorkout,
  deleteStandaloneWorkout,
} from "@/utils/database";
import { UserExercise } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";

export const useCreateStandaloneWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      exercises,
    }: {
      name: string;
      exercises: UserExercise[];
    }) => createStandaloneWorkout(name, exercises),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};

export const useUpdateStandaloneWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workoutId,
      name,
      exercises,
    }: {
      workoutId: number;
      name: string;
      exercises: UserExercise[];
    }) => updateStandaloneWorkout(workoutId, name, exercises),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};

export const useDeleteStandaloneWorkout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workoutId: number) => deleteStandaloneWorkout(workoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
    },
    onError: (error: Error) => {
      Bugsnag.notify(error);
    },
  });
};
