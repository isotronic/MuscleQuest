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
import Bugsnag from "@bugsnag/expo";
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

// ─── plans ────────────────────────────────────────────────────────────────────

export const publishPlan = async (
  uid: string,
  planId: number,
): Promise<void> => {
  const data = await fetchFullPlanForSharing(planId);
  if (!data) return;

  const now = serverTimestamp();
  const db = getFirestore();
  const ref = doc(db, "users", uid, "sharedPlans", String(planId));

  const existing = await getDoc(ref);
  const publishedAt = existing.exists() ? existing.data()?.publishedAt : now;

  await setDoc(ref, {
    localPlanId: planId,
    name: data.plan.name,
    imageUrl: data.plan.image_url ?? null,
    publishedAt,
    updatedAt: now,
    workouts: data.workouts.map((w) => ({
      name: w.workout_name,
      workoutOrder: w.workout_order,
      exercises: w.exercises.map(buildSharedExercise),
    })),
  });
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

  const existing = await getDoc(ref);
  const publishedAt = existing.exists() ? existing.data()?.publishedAt : now;

  await setDoc(ref, {
    localWorkoutId: workoutId,
    name: data.workout_name,
    imageUrl: data.image_url ?? null,
    publishedAt,
    updatedAt: now,
    exercises: data.exercises.map(buildSharedExercise),
  });
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

    await setDoc(ref, {
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
    });
  } catch (error) {
    Bugsnag.notify(error as Error);
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
    Bugsnag.notify(error as Error);
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
    await setDoc(
      doc(db, "users", uid, "sharedWorkouts", String(completedWorkoutId)),
      {
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
      },
    );
  } catch (error) {
    Bugsnag.notify(error as Error);
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
    await setDoc(doc(db, "users", uid, "sharedMeasurements", String(entryId)), {
      localEntryId: entryId,
      recordedAt: Timestamp.fromDate(new Date(data.recorded_at)),
      values: data.values,
    });
  } catch (error) {
    Bugsnag.notify(error as Error);
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

        batch.set(ref, {
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
        });
      }

      await batch.commit();
    }
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};

// ─── bulk publish ─────────────────────────────────────────────────────────────

export const bulkPublishAllPlans = async (uid: string): Promise<void> => {
  try {
    const planIds = await fetchAllPlanIds();
    const results = await Promise.allSettled(
      planIds.map((id) => publishPlan(uid, id)),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        Bugsnag.notify(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};

export const bulkPublishAllStandaloneWorkouts = async (
  uid: string,
): Promise<void> => {
  try {
    const workoutIds = await fetchAllStandaloneWorkoutIds();
    const results = await Promise.allSettled(
      workoutIds.map((id) => publishStandaloneWorkout(uid, id)),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        Bugsnag.notify(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};

export const bulkPublishAllCustomExercises = async (
  uid: string,
): Promise<void> => {
  try {
    const exercises = await fetchAllCustomExercisesForSharing();
    // pushCustomExercise catches its own errors and reports to Bugsnag, so allSettled sees fulfilled
    const results = await Promise.allSettled(
      exercises.map((ex) => pushCustomExercise(uid, ex)),
    );
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) =>
        Bugsnag.notify(
          r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
        ),
      );
  } catch (error) {
    Bugsnag.notify(error as Error);
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

export const deleteAllSharedData = async (uid: string): Promise<void> => {
  try {
    const subcollections = [
      "sharedPlans",
      "sharedStandaloneWorkouts",
      "sharedCustomExercises",
      "sharedWorkouts",
      "sharedMeasurements",
      "sharedStrength",
    ];
    await Promise.all(subcollections.map((c) => deleteSubcollection(uid, c)));
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};
