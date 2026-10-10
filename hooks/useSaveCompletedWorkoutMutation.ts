import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { saveCompletedWorkout, SavedWorkout } from "@/utils/database";
import { AuthContext, waitForAuthUser } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import {
  fetchPrivacySettings,
  pushCompletedWorkout,
  pushStrengthPRs,
} from "@/utils/sharing";
import { displayToKg, displayToMetres, roundCanonical } from "@/utils/units";
import type { FirestorePrivateSettings } from "@/types/firestore";

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
    workoutDataConverted.completedAt,
    workoutDataConverted.notes,
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

      const share = (
        uid: string,
        settings: FirestorePrivateSettings | null,
      ) => {
        if (settings?.shareCompletedWorkouts) {
          pushCompletedWorkout(uid, completedWorkoutId).catch((err) =>
            notifyBugsnag(err),
          );
        }

        if (settings?.shareStrengthProgress) {
          const exerciseIds = completedWorkoutData.exercises.map(
            (e) => e.exercise_id,
          );
          pushStrengthPRs(uid, exerciseIds).catch((err) => notifyBugsnag(err));
        }
      };

      if (user) {
        share(user.uid, privacySettings);
        return;
      }
      // A save right after launch can land before the session is restored;
      // nothing re-pushes completed workouts later, so wait for it here.
      waitForAuthUser()
        .then(async (restored) => {
          if (!restored) return;
          share(restored.uid, await fetchPrivacySettings(restored.uid));
        })
        .catch(notifyBugsnag);
    },
  });
};
