import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { saveCompletedWorkout, SavedWorkout } from "@/utils/database";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { pushCompletedWorkout, pushStrengthPRs } from "@/utils/sharing";
import { displayToKg, displayToMetres, roundCanonical } from "@/utils/units";

const saveCompletedWorkoutWithConversion = async (
  completedWorkoutData: SavedWorkout,
  weightUnit: string,
  distanceUnit: string,
) => {
  // Rounded so the same input always stores the same value; see roundCanonical.
  const workoutDataConverted = {
    ...completedWorkoutData,
    exercises: completedWorkoutData.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        weight:
          set.weight == null
            ? null
            : roundCanonical(displayToKg(set.weight, weightUnit)),
        distance:
          set.distance != null
            ? roundCanonical(displayToMetres(set.distance, distanceUnit))
            : null,
      })),
    })),
  };

  return saveCompletedWorkout(
    workoutDataConverted.planId,
    workoutDataConverted.workoutId,
    workoutDataConverted.duration,
    workoutDataConverted.totalSetsCompleted,
    workoutDataConverted.isDeload ?? false,
    workoutDataConverted.exercises,
  );
};

export const useSaveCompletedWorkoutMutation = (
  weightUnit: string,
  distanceUnit: string = "m",
) => {
  const queryClient = useQueryClient();
  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  return useMutation({
    mutationFn: (completedWorkoutData: SavedWorkout) => {
      return saveCompletedWorkoutWithConversion(
        completedWorkoutData,
        weightUnit,
        distanceUnit,
      );
    },
    onSuccess: (completedWorkoutId, completedWorkoutData) => {
      queryClient.invalidateQueries({ queryKey: ["completedWorkouts"] });
      queryClient.invalidateQueries({ queryKey: ["exerciseDetail"] });
      queryClient.invalidateQueries({ queryKey: ["trackedExercises"] });
      queryClient.invalidateQueries({
        queryKey: ["globalExerciseHistoryForSession", weightUnit, distanceUnit],
      });

      if (!user) return;

      if (privacySettings?.shareCompletedWorkouts) {
        pushCompletedWorkout(user.uid, completedWorkoutId).catch((err) =>
          notifyBugsnag(err),
        );
      }

      if (privacySettings?.shareStrengthProgress) {
        const exerciseIds = completedWorkoutData.exercises.map(
          (e) => e.exercise_id,
        );
        pushStrengthPRs(user.uid, exerciseIds).catch((err) =>
          notifyBugsnag(err),
        );
      }
    },
  });
};
