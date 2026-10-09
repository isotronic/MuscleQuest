import { getAuth } from "@react-native-firebase/auth";
import { useSocialStore } from "@/store/socialStore";
import type { FirestorePrivateSettings } from "@/types/firestore";
import { notifyBugsnag } from "./bugsnagDedup";
import { fetchCompletedWorkoutExerciseIds } from "./database";
import {
  publishPlan,
  publishStandaloneWorkout,
  pushBodyMeasurement,
  pushCompletedWorkout,
  refreshStrengthPRs,
  unpublishBodyMeasurement,
  unpublishCompletedWorkout,
  unpublishPlan,
  unpublishStandaloneWorkout,
} from "./sharing";

// Keeps the shared Firestore copies in step with local deletes, edits and
// undos. Every call is fire-and-forget: the SDK queues writes offline and its
// promise only settles on server ack, so the local action never waits on it.
//
// The current user and toggles are read at the moment of the action, not from
// a render: undo runs seconds later, and a measurement delete runs after its
// screen has gone. A category switched off has already had its shared docs
// revoked, so there is nothing to update.

type ShareToggle = keyof FirestorePrivateSettings;

const currentUid = (): string | null => getAuth().currentUser?.uid ?? null;

const uidIfSharing = (toggle: ShareToggle): string | null => {
  const uid = currentUid();
  if (!uid) return null;
  return useSocialStore.getState().privacySettings?.[toggle] ? uid : null;
};

const fireAndForget = (work: Promise<unknown>): void => {
  work.catch((error) => notifyBugsnag(error));
};

const refreshPRsFor = (
  uid: string,
  completedWorkoutId: number,
  extraExerciseIds: number[],
): Promise<void> =>
  fetchCompletedWorkoutExerciseIds(completedWorkoutId).then((ids) =>
    refreshStrengthPRs(uid, [...new Set([...ids, ...extraExerciseIds])]),
  );

// ─── completed workouts ───────────────────────────────────────────────────────

export const syncCompletedWorkoutRemoved = (completedWorkoutId: number) => {
  const workoutsUid = uidIfSharing("shareCompletedWorkouts");
  if (workoutsUid) {
    fireAndForget(unpublishCompletedWorkout(workoutsUid, completedWorkoutId));
  }
  const strengthUid = uidIfSharing("shareStrengthProgress");
  if (strengthUid) {
    fireAndForget(refreshPRsFor(strengthUid, completedWorkoutId, []));
  }
};

/**
 * After an edit or an undone delete. extraExerciseIds names exercises that
 * were in the workout before the change, such as one swapped out by an edit,
 * whose PRs may also have moved.
 */
export const syncCompletedWorkoutChanged = (
  completedWorkoutId: number,
  extraExerciseIds: number[] = [],
) => {
  const workoutsUid = uidIfSharing("shareCompletedWorkouts");
  if (workoutsUid) {
    fireAndForget(pushCompletedWorkout(workoutsUid, completedWorkoutId));
  }
  const strengthUid = uidIfSharing("shareStrengthProgress");
  if (strengthUid) {
    fireAndForget(
      refreshPRsFor(strengthUid, completedWorkoutId, extraExerciseIds),
    );
  }
};

// ─── body measurements ────────────────────────────────────────────────────────

export const syncMeasurementChanged = (entryId: number) => {
  const uid = uidIfSharing("shareBodyMeasurements");
  if (uid) fireAndForget(pushBodyMeasurement(uid, entryId));
};

export const syncMeasurementRemoved = (entryId: number) => {
  const uid = uidIfSharing("shareBodyMeasurements");
  if (uid) fireAndForget(unpublishBodyMeasurement(uid, entryId));
};

// ─── plans and standalone workouts ────────────────────────────────────────────

// Plans and standalone workouts are published one by one, so the published
// list decides, not the toggle. A null list has not hydrated yet: unpublish
// anyway, since deleting a missing doc is harmless and leaving a published
// one visible is not.
const wasPublished = (ids: string[] | null, id: number): boolean | null =>
  ids === null ? null : ids.includes(String(id));

/** Returns whether the plan was published, for syncPlanRestored. */
export const syncPlanRemoved = (planId: number): boolean => {
  const uid = currentUid();
  const published = wasPublished(
    useSocialStore.getState().publishedPlanIds,
    planId,
  );
  if (uid && published !== false) {
    fireAndForget(unpublishPlan(uid, planId));
  }
  return published === true;
};

export const syncPlanRestored = (planId: number, wasPublished: boolean) => {
  const uid = currentUid();
  if (uid && wasPublished) fireAndForget(publishPlan(uid, planId));
};

/** Returns whether the workout was published, for syncStandaloneWorkoutRestored. */
export const syncStandaloneWorkoutRemoved = (workoutId: number): boolean => {
  const uid = currentUid();
  const published = wasPublished(
    useSocialStore.getState().publishedWorkoutIds,
    workoutId,
  );
  if (uid && published !== false) {
    fireAndForget(unpublishStandaloneWorkout(uid, workoutId));
  }
  return published === true;
};

export const syncStandaloneWorkoutRestored = (
  workoutId: number,
  wasPublished: boolean,
) => {
  const uid = currentUid();
  if (uid && wasPublished) {
    fireAndForget(publishStandaloneWorkout(uid, workoutId));
  }
};
