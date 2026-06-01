import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createStandaloneWorkout,
  updateStandaloneWorkout,
  deleteStandaloneWorkout,
} from "@/utils/database";
import { UserExercise } from "@/store/workoutStore";
import Bugsnag from "@bugsnag/expo";
import { AuthContext } from "@/context/AuthProvider";
import firestore from "@react-native-firebase/firestore";
import { publishStandaloneWorkout } from "@/utils/sharing";

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
  const user = useContext(AuthContext);
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
    onSuccess: (_, { workoutId }) => {
      queryClient.invalidateQueries({ queryKey: ["standaloneWorkouts"] });
      if (user) {
        const ref = firestore()
          .collection("users")
          .doc(user.uid)
          .collection("sharedStandaloneWorkouts")
          .doc(String(workoutId));
        ref
          .get()
          .then((snap) => {
            if ((snap as any).exists) {
              publishStandaloneWorkout(user.uid, workoutId).catch((err) =>
                Bugsnag.notify(err),
              );
            }
          })
          .catch((err) => Bugsnag.notify(err));
      }
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
