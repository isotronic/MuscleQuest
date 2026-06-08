import { useEffect, useRef, useContext } from "react";
import {
  getFirestore,
  collection,
  getDocs,
} from "@react-native-firebase/firestore";
import Bugsnag from "@bugsnag/expo";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import {
  fetchAllPlanIds,
  fetchAllStandaloneWorkoutIds,
  fetchAllCustomExercisesForSharing,
} from "@/utils/database";
import {
  publishPlan,
  publishStandaloneWorkout,
  pushCustomExercise,
} from "@/utils/sharing";

export const useSocialSyncOnStartup = () => {
  const user = useContext(AuthContext);
  const { privacySettings, publishedPlanIds, publishedWorkoutIds } =
    useSocialStore();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!user || !privacySettings || hasSynced.current) return;
    if (publishedPlanIds === null || publishedWorkoutIds === null) return;
    hasSynced.current = true;

    const sync = async () => {
      const db = getFirestore();
      const { uid } = user;

      await Promise.allSettled([
        (async () => {
          if (!privacySettings.sharePlans) return;
          const localIds = await fetchAllPlanIds();
          const published = new Set(publishedPlanIds);
          const missing = localIds.filter((id) => !published.has(String(id)));
          await Promise.allSettled(missing.map((id) => publishPlan(uid, id)));
        })(),

        (async () => {
          if (!privacySettings.shareStandaloneWorkouts) return;
          const localIds = await fetchAllStandaloneWorkoutIds();
          const published = new Set(publishedWorkoutIds);
          const missing = localIds.filter((id) => !published.has(String(id)));
          await Promise.allSettled(
            missing.map((id) => publishStandaloneWorkout(uid, id)),
          );
        })(),

        (async () => {
          if (!privacySettings.shareCustomExercises) return;
          const [exercises, snap] = await Promise.all([
            fetchAllCustomExercisesForSharing(),
            getDocs(collection(db, "users", uid, "sharedCustomExercises")),
          ]);
          const published = new Set(snap.docs.map((d) => d.id));
          const missing = exercises.filter(
            (ex) =>
              ex.exercise_id != null &&
              !published.has(String(ex.exercise_id)),
          );
          await Promise.allSettled(
            missing.map((ex) => pushCustomExercise(uid, ex)),
          );
        })(),
      ]);
    };

    sync().catch((err) => Bugsnag.notify(err));
  }, [user, privacySettings, publishedPlanIds, publishedWorkoutIds]);
};
