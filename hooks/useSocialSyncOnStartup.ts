import { useEffect, useRef, useContext } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import Bugsnag from "@bugsnag/expo";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import {
  fetchAllPlanIds,
  fetchAllStandaloneWorkoutIds,
  fetchAllCustomExercisesForSharing,
  Exercise,
} from "@/utils/database";
import {
  publishPlan,
  publishStandaloneWorkout,
  pushCustomExercise,
} from "@/utils/sharing";

type QDocSnap = FirebaseFirestoreTypes.QueryDocumentSnapshot;

export const useSocialSyncOnStartup = () => {
  const user = useContext(AuthContext);
  const { privacySettings } = useSocialStore();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!user || !privacySettings || hasSynced.current) return;
    // Set before the async call so re-renders during the sync don't trigger a second run
    hasSynced.current = true;

    const sync = async () => {
      const db = getFirestore();
      const { uid } = user;

      await Promise.allSettled([
        (async () => {
          if (!privacySettings.sharePlans) return;
          const [localIds, snap] = await Promise.all([
            fetchAllPlanIds(),
            getDocs(collection(db, "users", uid, "sharedPlans")),
          ]);
          const published = new Set(snap.docs.map((d: QDocSnap) => d.id));
          const missing = localIds.filter((id: number) => !published.has(String(id)));
          await Promise.allSettled(missing.map((id: number) => publishPlan(uid, id)));
        })(),

        (async () => {
          if (!privacySettings.shareStandaloneWorkouts) return;
          const [localIds, snap] = await Promise.all([
            fetchAllStandaloneWorkoutIds(),
            getDocs(collection(db, "users", uid, "sharedStandaloneWorkouts")),
          ]);
          const published = new Set(snap.docs.map((d: QDocSnap) => d.id));
          const missing = localIds.filter((id: number) => !published.has(String(id)));
          await Promise.allSettled(
            missing.map((id: number) => publishStandaloneWorkout(uid, id)),
          );
        })(),

        (async () => {
          if (!privacySettings.shareCustomExercises) return;
          const [exercises, snap] = await Promise.all([
            fetchAllCustomExercisesForSharing(),
            getDocs(collection(db, "users", uid, "sharedCustomExercises")),
          ]);
          const published = new Set(snap.docs.map((d: QDocSnap) => d.id));
          const missing = exercises.filter(
            (ex: Exercise) =>
              ex.exercise_id != null &&
              !published.has(String(ex.exercise_id)),
          );
          await Promise.allSettled(
            missing.map((ex: Exercise) => pushCustomExercise(uid, ex)),
          );
        })(),
      ]);
    };

    sync().catch((err) => Bugsnag.notify(err));
  }, [user, privacySettings]);
};
