import { useEffect, useRef, useContext } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { notifyBugsnag } from "@/utils/bugsnagDedup";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import {
  fetchAllPlanIds,
  fetchAllStandaloneWorkoutIds,
  fetchAllCustomExercisesForSharing,
  Exercise,
} from "@/utils/database";
import pLimit from "p-limit";
import {
  BULK_PUBLISH_CONCURRENCY,
  publishPlan,
  publishStandaloneWorkout,
  pushCustomExercise,
  deleteAllSharedData,
} from "@/utils/sharing";

export const useSocialSyncOnStartup = () => {
  const user = useContext(AuthContext);
  const {
    privacySettings,
    publishedPlanIds,
    publishedWorkoutIds,
    pendingRevocation,
  } = useSocialStore();
  const hasSynced = useRef(false);
  const hasRetriedRevocations = useRef(false);

  // A revocation the user asked for but that failed (offline, permission
  // hiccup) is retried here until every subcollection is verified empty.
  // Runs independently of the publish sync: it must happen even when every
  // sharing toggle is off, which is the usual state after a revocation.
  // Subscribed rather than read once from getState(): the store rehydrates
  // from AsyncStorage after the first render, so an effect keyed only on
  // `user` would look before the persisted revocation had arrived and never
  // retry it that launch.
  useEffect(() => {
    if (!user || hasRetriedRevocations.current) return;
    if (!pendingRevocation) return;
    const { setPendingRevocation } = useSocialStore.getState();
    // The store is persisted and survives sign-out, so a revocation left by a
    // previous account must not be replayed against whoever signs in next:
    // the subcollection names would match and we would delete their data.
    if (pendingRevocation.uid !== user.uid) {
      setPendingRevocation(null);
      return;
    }
    hasRetriedRevocations.current = true;

    const { uid } = user;
    deleteAllSharedData(uid, pendingRevocation.subcollections)
      .then(() => useSocialStore.getState().setPendingRevocation(null))
      .catch((error) => {
        // deleteAllSharedData already reported this; keep the remaining names
        // so the next startup tries again.
        const failed = (error as { failedSubcollections?: string[] })
          .failedSubcollections;
        if (failed) {
          useSocialStore
            .getState()
            .setPendingRevocation({ uid, subcollections: failed });
        }
      });
  }, [user, pendingRevocation]);

  useEffect(() => {
    if (!user || !privacySettings || hasSynced.current) return;
    if (publishedPlanIds === null || publishedWorkoutIds === null) return;
    hasSynced.current = true;

    const sync = async () => {
      const db = getFirestore();
      const { uid } = user;
      // Same cap as the bulk publishers: a large library would otherwise open
      // one request per missing item at app start.
      const throttle = pLimit(BULK_PUBLISH_CONCURRENCY);

      await Promise.allSettled([
        (async () => {
          if (!privacySettings.sharePlans) return;
          const localIds = await fetchAllPlanIds();
          const published = new Set(publishedPlanIds);
          const missing = localIds.filter((id) => !published.has(String(id)));
          await Promise.allSettled(
            missing.map((id) => throttle(() => publishPlan(uid, id))),
          );
        })(),

        (async () => {
          if (!privacySettings.shareStandaloneWorkouts) return;
          const localIds = await fetchAllStandaloneWorkoutIds();
          const published = new Set(publishedWorkoutIds);
          const missing = localIds.filter((id) => !published.has(String(id)));
          await Promise.allSettled(
            missing.map((id) =>
              throttle(() => publishStandaloneWorkout(uid, id)),
            ),
          );
        })(),

        (async () => {
          if (!privacySettings.shareCustomExercises) return;
          const [exercises, snap] = await Promise.all([
            fetchAllCustomExercisesForSharing(),
            getDocs(collection(db, "users", uid, "sharedCustomExercises")),
          ]);
          const published = new Set(
            snap.docs.map(
              (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => d.id,
            ),
          );
          const missing = exercises.filter(
            (ex: Exercise) =>
              ex.exercise_id != null && !published.has(String(ex.exercise_id)),
          );
          await Promise.allSettled(
            missing.map((ex: Exercise) =>
              throttle(() => pushCustomExercise(uid, ex)),
            ),
          );
        })(),
      ]);
    };

    sync().catch((err) => notifyBugsnag(err));
  }, [user, privacySettings, publishedPlanIds, publishedWorkoutIds]);
};
