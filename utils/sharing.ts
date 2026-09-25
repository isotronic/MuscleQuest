import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  limit,
  serverTimestamp,
  Timestamp,
} from "@react-native-firebase/firestore";
import pLimit from "p-limit";
import { notifyBugsnag } from "./bugsnagDedup";
import { useSocialStore } from "../store/socialStore";
import {
  fetchFullPlanForSharing,
  fetchStandaloneWorkoutForSharing,
  fetchCompletedWorkoutForSharing,
  fetchBodyMeasurementEntryForSharing,
  fetchPRDataForExercises,
  fetchAllPlanIds,
  fetchAllStandaloneWorkoutIds,
  fetchAllCustomExercisesForSharing,
} from "./database";
import type { Exercise } from "./database";

// ─── helpers ──────────────────────────────────────────────────────────────────

const parseSecondaryMuscles = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const parseSets = (raw: string | null): any[] => {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const buildSharedExercise = (row: {
  exercise_id: number | null;
  app_exercise_id: number | null;
  exercise_name: string | null;
  animated_url: string | null;
  equipment: string | null;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string | null;
  tracking_type: string | null;
  is_unilateral: number;
  double_weight: number;
  tracking_type_override: string | null;
  sets: string | null;
  exercise_order: number;
  superset_group_id: string | null;
}) => ({
  appExerciseId: row.app_exercise_id ?? null,
  name: row.exercise_name ?? "",
  equipment: row.equipment ?? "",
  bodyPart: row.body_part ?? "",
  targetMuscle: row.target_muscle ?? "",
  secondaryMuscles: parseSecondaryMuscles(row.secondary_muscles),
  trackingType: row.tracking_type ?? "weight",
  isUnilateral: !!row.is_unilateral,
  doubleWeight: !!row.double_weight,
  animatedUrl: row.animated_url ?? null,
  sets: parseSets(row.sets).map((s: any) => ({
    repsMin: s.repsMin ?? null,
    repsMax: s.repsMax ?? null,
    restMinutes: s.restMinutes ?? 0,
    restSeconds: s.restSeconds ?? 0,
    time: s.time ?? null,
    distance: s.distance ?? null,
    isWarmup: !!s.isWarmup,
    isDropSet: !!s.isDropSet,
    isToFailure: !!(s.isToFailure ?? s.toFailure),
  })),
  exerciseOrder: row.exercise_order,
  supersetGroupId: row.superset_group_id ?? null,
  trackingTypeOverride: row.tracking_type_override ?? null,
});

// Firestore rejects documents over 1 MiB, and a rules check can't measure
// bytes. Guard on the client instead so the user gets an explanation rather
// than a raw invalid-argument error. JSON length overestimates slightly
// against Firestore's own accounting, which is what we want for a budget.
const MAX_SHARED_DOC_BYTES = 900_000;

export class SharedDocTooLargeError extends Error {
  readonly estimatedBytes: number;

  constructor(estimatedBytes: number) {
    super(
      `Shared document is too large: ~${estimatedBytes} bytes (limit ${MAX_SHARED_DOC_BYTES})`,
    );
    this.name = "SharedDocTooLargeError";
    this.estimatedBytes = estimatedBytes;
  }
}

const assertWithinSizeBudget = (data: object): void => {
  // serverTimestamp() sentinels serialise to a small object, so the estimate
  // stays close enough for a budget this far below the hard limit.
  const estimatedBytes = JSON.stringify(data)?.length ?? 0;
  if (estimatedBytes > MAX_SHARED_DOC_BYTES) {
    throw new SharedDocTooLargeError(estimatedBytes);
  }
};

// publishedAt must only be set the first time a document is written. The
// listener-backed published id lists in socialStore already tell us whether a
// document exists, which saves a getDoc round trip before every publish.
const isAlreadyPublished = (
  kind: "plan" | "standaloneWorkout",
  id: number,
): boolean => {
  const { publishedPlanIds, publishedWorkoutIds } = useSocialStore.getState();
  const ids = kind === "plan" ? publishedPlanIds : publishedWorkoutIds;
  return ids?.includes(String(id)) ?? false;
};

// Bulk publishing fans out one write per plan/workout/exercise. Without a cap
// a large library opens hundreds of concurrent requests, which starves the
// rest of the app's Firestore traffic and invites throttling.
export const BULK_PUBLISH_CONCURRENCY = 4;

// ─── plans ────────────────────────────────────────────────────────────────────

export const publishPlan = async (
  uid: string,
  planId: number,
): Promise<void> => {
  const data = await fetchFullPlanForSharing(planId);
  if (!data || data.plan.app_plan_id !== null) return;

  const now = serverTimestamp();
  const db = getFirestore();
  const ref = doc(db, "users", uid, "sharedPlans", String(planId));

  const payload: Record<string, unknown> = {
    localPlanId: planId,
    name: data.plan.name,
    imageUrl: data.plan.image_url ?? null,
    updatedAt: now,
    workouts: data.workouts.map((w) => ({
      name: w.workout_name,
      workoutOrder: w.workout_order,
      exercises: w.exercises.map(buildSharedExercise),
    })),
  };
  if (!isAlreadyPublished("plan", planId)) {
    payload.publishedAt = now;
  }

  assertWithinSizeBudget(payload);
  await setDoc(ref, payload, { merge: true });
};

export const unpublishPlan = async (
  uid: string,
  planId: number,
): Promise<void> => {
  const db = getFirestore();
  await deleteDoc(doc(db, "users", uid, "sharedPlans", String(planId)));
};

// ─── standalone workouts ──────────────────────────────────────────────────────

export const publishStandaloneWorkout = async (
  uid: string,
  workoutId: number,
): Promise<void> => {
  const data = await fetchStandaloneWorkoutForSharing(workoutId);
  if (!data) return;

  const now = serverTimestamp();
  const db = getFirestore();
  const ref = doc(
    db,
    "users",
    uid,
    "sharedStandaloneWorkouts",
    String(workoutId),
  );

  const payload: Record<string, unknown> = {
    localWorkoutId: workoutId,
    name: data.workout_name,
    imageUrl: data.image_url ?? null,
    updatedAt: now,
    exercises: data.exercises.map(buildSharedExercise),
  };
  if (!isAlreadyPublished("standaloneWorkout", workoutId)) {
    payload.publishedAt = now;
  }

  assertWithinSizeBudget(payload);
  await setDoc(ref, payload, { merge: true });
};

export const unpublishStandaloneWorkout = async (
  uid: string,
  workoutId: number,
): Promise<void> => {
  const db = getFirestore();
  await deleteDoc(
    doc(db, "users", uid, "sharedStandaloneWorkouts", String(workoutId)),
  );
};

// ─── custom exercises ─────────────────────────────────────────────────────────

export const pushCustomExercise = async (
  uid: string,
  exercise: Exercise,
): Promise<void> => {
  try {
    const now = serverTimestamp();
    const db = getFirestore();
    const ref = doc(
      db,
      "users",
      uid,
      "sharedCustomExercises",
      String(exercise.exercise_id),
    );

    const existing = await getDoc(ref);
    const publishedAt = existing.exists() ? existing.data()?.publishedAt : now;

    const payload = {
      localExerciseId: exercise.exercise_id,
      name: exercise.name,
      equipment: exercise.equipment ?? "",
      bodyPart: exercise.body_part ?? "",
      targetMuscle: exercise.target_muscle ?? "",
      secondaryMuscles: Array.isArray(exercise.secondary_muscles)
        ? exercise.secondary_muscles
        : parseSecondaryMuscles(
            exercise.secondary_muscles as unknown as string,
          ),
      description: exercise.description ?? null,
      trackingType: exercise.tracking_type ?? "weight",
      isUnilateral: !!exercise.is_unilateral,
      doubleWeight: !!exercise.double_weight,
      animatedUrl: exercise.animated_url ?? null,
      publishedAt,
      updatedAt: now,
    };

    assertWithinSizeBudget(payload);
    await setDoc(ref, payload);
  } catch (error) {
    notifyBugsnag(error);
  }
};

export const removeCustomExercise = async (
  uid: string,
  exerciseId: number,
): Promise<void> => {
  try {
    const db = getFirestore();
    await deleteDoc(
      doc(db, "users", uid, "sharedCustomExercises", String(exerciseId)),
    );
  } catch (error) {
    notifyBugsnag(error);
  }
};

// ─── completed workouts ───────────────────────────────────────────────────────

export const pushCompletedWorkout = async (
  uid: string,
  completedWorkoutId: number,
): Promise<void> => {
  try {
    const data = await fetchCompletedWorkoutForSharing(completedWorkoutId);
    if (!data) return;

    const db = getFirestore();
    const payload = {
      localWorkoutId: completedWorkoutId,
      planName: data.plan_name ?? null,
      workoutName: data.workout_name ?? null,
      dateCompleted: Timestamp.fromDate(new Date(data.date_completed)),
      durationSeconds: data.duration,
      totalSetsCompleted: data.total_sets_completed,
      isDeload: !!data.is_deload,
      exercises: data.exercises.map((ex) => ({
        name: ex.exercise_name,
        sets: ex.sets.map((s) => ({
          setNumber: s.set_number,
          weight: s.weight,
          reps: s.reps,
          time: s.time,
          distance: s.distance,
          isWarmup: !!s.is_warmup,
          isDropSet: !!s.is_drop_set,
          isToFailure: !!s.is_to_failure,
        })),
      })),
    };

    assertWithinSizeBudget(payload);
    await setDoc(
      doc(db, "users", uid, "sharedWorkouts", String(completedWorkoutId)),
      payload,
    );
  } catch (error) {
    notifyBugsnag(error);
  }
};

// ─── body measurements ────────────────────────────────────────────────────────

export const pushBodyMeasurement = async (
  uid: string,
  entryId: number,
): Promise<void> => {
  try {
    const data = await fetchBodyMeasurementEntryForSharing(entryId);
    if (!data) return;

    const db = getFirestore();
    const payload = {
      localEntryId: entryId,
      recordedAt: Timestamp.fromDate(new Date(data.recorded_at)),
      values: data.values,
    };

    assertWithinSizeBudget(payload);
    await setDoc(
      doc(db, "users", uid, "sharedMeasurements", String(entryId)),
      payload,
    );
  } catch (error) {
    notifyBugsnag(error);
  }
};

// ─── strength PRs ─────────────────────────────────────────────────────────────

export const pushStrengthPRs = async (
  uid: string,
  exerciseIds: number[],
): Promise<void> => {
  try {
    const prData = await fetchPRDataForExercises(exerciseIds);
    if (prData.length === 0) return;

    const db = getFirestore();
    const BATCH_LIMIT = 500;

    for (let i = 0; i < prData.length; i += BATCH_LIMIT) {
      const chunk = prData.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);

      for (const pr of chunk) {
        const docId =
          pr.app_exercise_id != null
            ? `app_${pr.app_exercise_id}`
            : `custom_${pr.exercise_id}`;
        const ref = doc(db, "users", uid, "sharedStrength", docId);

        const payload = {
          exerciseName: pr.exercise_name,
          appExerciseId: pr.app_exercise_id,
          trackingType: pr.tracking_type,
          allTimePR: pr.all_time_pr,
          allTimePRDate: Timestamp.fromDate(new Date(pr.all_time_pr_date)),
          topPRSets: pr.top_sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            time: s.time,
            distance: s.distance,
            date: Timestamp.fromDate(new Date(s.date_completed)),
          })),
        };

        assertWithinSizeBudget(payload);
        batch.set(ref, payload);
      }

      await batch.commit();
    }
  } catch (error) {
    notifyBugsnag(error);
  }
};

// ─── bulk publish ─────────────────────────────────────────────────────────────

export const bulkPublishAllPlans = async (uid: string): Promise<void> => {
  try {
    const planIds = await fetchAllPlanIds();
    const throttle = pLimit(BULK_PUBLISH_CONCURRENCY);
    const results = await Promise.allSettled(
      planIds.map((id) => throttle(() => publishPlan(uid, id))),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        notifyBugsnag(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    notifyBugsnag(error);
  }
};

export const bulkPublishAllStandaloneWorkouts = async (
  uid: string,
): Promise<void> => {
  try {
    const workoutIds = await fetchAllStandaloneWorkoutIds();
    const throttle = pLimit(BULK_PUBLISH_CONCURRENCY);
    const results = await Promise.allSettled(
      workoutIds.map((id) => throttle(() => publishStandaloneWorkout(uid, id))),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        notifyBugsnag(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    notifyBugsnag(error);
  }
};

export const bulkPublishAllCustomExercises = async (
  uid: string,
): Promise<void> => {
  try {
    const exercises = await fetchAllCustomExercisesForSharing();
    // pushCustomExercise catches its own errors and reports to Bugsnag, so allSettled sees fulfilled
    const throttle = pLimit(BULK_PUBLISH_CONCURRENCY);
    const results = await Promise.allSettled(
      exercises.map((ex) => throttle(() => pushCustomExercise(uid, ex))),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        notifyBugsnag(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    notifyBugsnag(error);
  }
};

// ─── delete all shared data ───────────────────────────────────────────────────

const deleteSubcollection = async (
  uid: string,
  subcollection: string,
): Promise<void> => {
  const db = getFirestore();
  const collRef = collection(db, "users", uid, subcollection);

  let snapshot = await getDocs(query(collRef, limit(500)));
  while (!snapshot.empty) {
    const batch = writeBatch(db);
    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    if (snapshot.docs.length < 500) break;
    snapshot = await getDocs(query(collRef, limit(500)));
  }
};

export const SHARED_SUBCOLLECTIONS = [
  "sharedPlans",
  "sharedStandaloneWorkouts",
  "sharedCustomExercises",
  "sharedWorkouts",
  "sharedMeasurements",
  "sharedStrength",
] as const;

export type SharedSubcollection = (typeof SHARED_SUBCOLLECTIONS)[number];

// Thrown when one or more subcollections could not be emptied. Naming the
// subcollections lets the caller retry only those, and lets it persist them
// so the retry survives an app restart.
export class SharedDataDeletionError extends Error {
  readonly failedSubcollections: string[];

  constructor(failedSubcollections: string[], options?: { cause?: unknown }) {
    super(
      `Failed to delete shared data: ${failedSubcollections.join(", ")}`,
      options,
    );
    this.name = "SharedDataDeletionError";
    this.failedSubcollections = failedSubcollections;
  }
}

// Deletes a subcollection, then re-reads it to confirm it is actually empty.
// A batch commit can succeed while a concurrent write re-adds a document, and
// a partially applied delete would otherwise look like success.
const deleteSubcollectionAndVerify = async (
  uid: string,
  subcollection: string,
): Promise<void> => {
  await deleteSubcollection(uid, subcollection);

  const db = getFirestore();
  const remaining = await getDocs(
    query(collection(db, "users", uid, subcollection), limit(1)),
  );
  if (!remaining.empty) {
    throw new Error(`${subcollection} still has documents after deletion`);
  }
};

// Empties the named shared subcollections (all six by default) and throws a
// SharedDataDeletionError naming the ones that failed. Never resolves on a
// partial delete: callers use the result to decide whether sharing is really
// off, so reporting success while data stays visible would be a privacy bug.
export const deleteAllSharedData = async (
  uid: string,
  subcollections: readonly string[] = SHARED_SUBCOLLECTIONS,
): Promise<void> => {
  const results = await Promise.allSettled(
    subcollections.map((c) => deleteSubcollectionAndVerify(uid, c)),
  );

  const failed: string[] = [];
  let firstReason: unknown;
  results.forEach((result, index) => {
    if (result.status !== "rejected") return;
    failed.push(subcollections[index]);
    if (firstReason === undefined) firstReason = result.reason;
  });

  if (failed.length > 0) {
    const error = new SharedDataDeletionError(failed, { cause: firstReason });
    notifyBugsnag(error, (event) => {
      event.addMetadata("shared_data_deletion", {
        failed: failed.join(", "),
        reason: String(firstReason),
      });
    });
    throw error;
  }
};
