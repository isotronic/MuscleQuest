// Demo friends: local stand-ins for the Firestore social layer. The friend
// screens read the social store and the useFriendShared*Query hooks; demo
// mode fills the first and answers the second for demo- uids, so nothing here
// touches the network.
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { useSocialStore, type PendingRequest } from "@/store/socialStore";
import { showSnackbar } from "@/store/snackbarStore";
import type {
  FirestorePrivateSettings,
  FriendInfo,
  SharedCompletedSet,
  SharedCompletedWorkout,
  SharedCustomExercise,
  SharedExercise,
  SharedMeasurement,
  SharedPlan,
  SharedStandaloneWorkout,
  SharedStrengthPR,
} from "@/types/firestore";
import fixture from "./fixtures/friends.json";

type SetPair = [number, number];

interface CatalogueExercise {
  name: string;
  equipment: string;
  bodyPart: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  isUnilateral?: boolean;
  doubleWeight: boolean;
  animatedUrl: string | null;
}

interface PlanExerciseFixture {
  appExerciseId: number;
  working: number;
  repsMin: number;
  repsMax: number;
  rest: number;
  warmups?: number;
  superset?: string;
}

interface FriendFixture {
  uid: string;
  displayName: string;
  friendsSinceDays: number;
  completedWorkoutCount: number;
  plans: {
    localPlanId: number;
    name: string;
    imageUrl: string | null;
    publishedDays: number;
    updatedDays: number;
    workouts: { name: string; exercises: PlanExerciseFixture[] }[];
  }[];
  completedWorkouts: {
    localWorkoutId: number;
    day: number;
    start: string;
    minutes: number;
    planName: string | null;
    workoutName: string;
    exercises: {
      appExerciseId: number;
      warmups?: SetPair[];
      sets: SetPair[];
    }[];
  }[];
  /** Top sets as [kg, reps, day]. */
  strength: { appExerciseId: number; topSets: [number, number, number][] }[];
  measurements: {
    localEntryId: number;
    day: number;
    values: Record<string, number>;
  }[];
}

interface FriendsFixture {
  exercises: Record<string, CatalogueExercise>;
  friends: FriendFixture[];
  requests: { uid: string; displayName: string; day: number }[];
}

const fx = fixture as unknown as FriendsFixture;

/** What the demo friends see as this user's sharing: nothing. */
const DEMO_PRIVACY: FirestorePrivateSettings = {
  sharePlans: false,
  shareStandaloneWorkouts: false,
  shareCustomExercises: false,
  shareCompletedWorkouts: false,
  shareBodyMeasurements: false,
  shareStrengthProgress: false,
};

// ─── dates ────────────────────────────────────────────────────────────────────

const daysFromNow = (days: number, time = "12:00", now = new Date()): Date => {
  const [h, m] = time.split(":").map(Number);
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
    h,
    m,
  );
};

// The screens only call toDate() on these.
const timestamp = (date: Date): FirebaseFirestoreTypes.Timestamp =>
  ({
    toDate: () => new Date(date),
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as FirebaseFirestoreTypes.Timestamp;

// ─── local state ──────────────────────────────────────────────────────────────

// Changes made in the friend screens this session. Not persisted: a reload
// brings the fixture back as it was.
const local = {
  accepted: new Set<string>(),
  declined: new Set<string>(),
  removed: new Set<string>(),
};

export const resetDemoSocialState = () => {
  local.accepted.clear();
  local.declined.clear();
  local.removed.clear();
};

const demoFriends = (now = new Date()): FriendInfo[] => {
  const friends: FriendInfo[] = fx.friends.map((f) => ({
    uid: f.uid,
    displayName: f.displayName,
    photoURL: "",
    since: daysFromNow(f.friendsSinceDays, "12:00", now).getTime(),
  }));
  for (const r of fx.requests) {
    if (local.accepted.has(r.uid)) {
      friends.push({
        uid: r.uid,
        displayName: r.displayName,
        photoURL: "",
        since: now.getTime(),
      });
    }
  }
  return friends.filter((f) => !local.removed.has(f.uid));
};

const demoPendingRequests = (now = new Date()): PendingRequest[] =>
  fx.requests
    .filter((r) => !local.accepted.has(r.uid) && !local.declined.has(r.uid))
    .map((r) => ({
      id: `${r.uid}_me`,
      fromUid: r.uid,
      displayName: r.displayName,
      photoURL: "",
      createdAt: daysFromNow(r.day, "20:30", now),
    }));

/** Puts the demo friends and request in the social store, in place of the listeners. */
export const applyDemoSocialState = () => {
  const store = useSocialStore.getState();
  store.setFriends(demoFriends());
  store.setPendingRequests(demoPendingRequests());
  store.setSentRequests([]);
  store.setPrivacySettings(DEMO_PRIVACY);
  store.setPublishedPlanIds([]);
  store.setPublishedWorkoutIds([]);
};

/** Empties the social store; the real listeners refill it once resubscribed. */
export const clearDemoSocialState = () => {
  resetDemoSocialState();
  const store = useSocialStore.getState();
  store.setFriends([]);
  store.setPendingRequests([]);
  store.setSentRequests([]);
  store.setPrivacySettings(null);
  store.setPublishedPlanIds(null);
  store.setPublishedWorkoutIds(null);
};

export const acceptDemoRequest = async (uid: string): Promise<void> => {
  local.accepted.add(uid);
  applyDemoSocialState();
  showSnackbar("Demo: request accepted on this device only.");
};

export const declineDemoRequest = async (uid: string): Promise<void> => {
  local.declined.add(uid);
  applyDemoSocialState();
  showSnackbar("Demo: request declined on this device only.");
};

export const removeDemoFriend = async (uid: string): Promise<void> => {
  local.removed.add(uid);
  applyDemoSocialState();
  showSnackbar("Demo: friend removed on this device only.");
};

// ─── shared data ──────────────────────────────────────────────────────────────

const catalogue = (appExerciseId: number): CatalogueExercise => {
  const entry = fx.exercises[String(appExerciseId)];
  if (!entry) throw new Error(`Demo friend exercise ${appExerciseId} missing`);
  return entry;
};

const sharedExercise = (
  e: PlanExerciseFixture,
  exerciseOrder: number,
): SharedExercise => {
  const c = catalogue(e.appExerciseId);
  const rest = {
    restMinutes: Math.floor(e.rest / 60),
    restSeconds: e.rest % 60,
  };
  const blank = {
    time: null,
    distance: null,
    isDropSet: false,
    isToFailure: false,
  };
  return {
    appExerciseId: e.appExerciseId,
    name: c.name,
    equipment: c.equipment,
    bodyPart: c.bodyPart,
    targetMuscle: c.targetMuscle,
    secondaryMuscles: c.secondaryMuscles,
    trackingType: "weight",
    isUnilateral: c.isUnilateral ?? false,
    doubleWeight: c.doubleWeight,
    animatedUrl: c.animatedUrl,
    sets: [
      ...Array.from({ length: e.warmups ?? 0 }, () => ({
        ...blank,
        repsMin: 8,
        repsMax: 8,
        restMinutes: 1,
        restSeconds: 0,
        isWarmup: true,
      })),
      ...Array.from({ length: e.working }, () => ({
        ...blank,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        ...rest,
        isWarmup: false,
      })),
    ],
    exerciseOrder,
    supersetGroupId: e.superset ? `demo-${e.superset}` : null,
    trackingTypeOverride: null,
  };
};

const completedSet = (
  [weight, reps]: SetPair,
  setNumber: number,
  isWarmup: boolean,
): SharedCompletedSet => ({
  setNumber,
  weight,
  reps,
  time: null,
  distance: null,
  isWarmup,
  isDropSet: false,
  isToFailure: false,
});

// Epley, as progressionMetricSql judges PRs; paired weights count twice.
const estimatedOneRepMax = (appExerciseId: number, kg: number, reps: number) =>
  kg * (catalogue(appExerciseId).doubleWeight ? 2 : 1) * (1 + reps / 30);

export interface DemoFriendData {
  plans: SharedPlan[];
  standaloneWorkouts: SharedStandaloneWorkout[];
  customExercises: SharedCustomExercise[];
  completedWorkouts: SharedCompletedWorkout[];
  completedWorkoutCount: number;
  measurements: SharedMeasurement[];
  strength: SharedStrengthPR[];
}

const EMPTY: DemoFriendData = {
  plans: [],
  standaloneWorkouts: [],
  customExercises: [],
  completedWorkouts: [],
  completedWorkoutCount: 0,
  measurements: [],
  strength: [],
};

/** Everything a demo friend shares, in the shapes the Firestore reads return. */
export const demoFriendData = (
  uid: string,
  now = new Date(),
): DemoFriendData => {
  const f = fx.friends.find((friend) => friend.uid === uid);
  if (!f) return EMPTY;
  return {
    plans: f.plans.map((p) => ({
      localPlanId: p.localPlanId,
      name: p.name,
      imageUrl: p.imageUrl,
      publishedAt: timestamp(daysFromNow(p.publishedDays, "20:00", now)),
      updatedAt: timestamp(daysFromNow(p.updatedDays, "20:00", now)),
      workouts: p.workouts.map((w, workoutOrder) => ({
        name: w.name,
        workoutOrder,
        exercises: w.exercises.map(sharedExercise),
      })),
    })),
    standaloneWorkouts: [],
    customExercises: [],
    completedWorkouts: f.completedWorkouts.map((w) => {
      const end = new Date(
        daysFromNow(w.day, w.start, now).getTime() + w.minutes * 60_000,
      );
      const exercises = w.exercises.map((e) => {
        const warmups = e.warmups ?? [];
        return {
          name: catalogue(e.appExerciseId).name,
          sets: [
            ...warmups.map((s, i) => completedSet(s, i + 1, true)),
            ...e.sets.map((s, i) =>
              completedSet(s, warmups.length + i + 1, false),
            ),
          ],
        };
      });
      return {
        localWorkoutId: w.localWorkoutId,
        planName: w.planName,
        workoutName: w.workoutName,
        dateCompleted: timestamp(end),
        durationSeconds: w.minutes * 60,
        totalSetsCompleted: exercises.reduce((n, e) => n + e.sets.length, 0),
        isDeload: false,
        exercises,
      };
    }),
    completedWorkoutCount: Math.max(
      f.completedWorkoutCount,
      f.completedWorkouts.length,
    ),
    measurements: f.measurements.map((m) => ({
      localEntryId: m.localEntryId,
      recordedAt: timestamp(daysFromNow(m.day, "07:30", now)),
      values: m.values,
    })),
    strength: f.strength.map((s) => {
      const scored = s.topSets.map(([kg, reps, day]) => ({
        kg,
        reps,
        day,
        e1rm: estimatedOneRepMax(s.appExerciseId, kg, reps),
      }));
      const best = scored.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
      // The earliest day the PR was reached, as fetchPRDataForExercises dates it.
      const prDay = Math.min(
        ...scored.filter((t) => t.e1rm > best.e1rm - 0.01).map((t) => t.day),
      );
      return {
        exerciseName: catalogue(s.appExerciseId).name,
        appExerciseId: s.appExerciseId,
        trackingType: "weight",
        allTimePR: best.e1rm,
        allTimePRDate: timestamp(daysFromNow(prDay, "12:00", now)),
        topPRSets: [...scored]
          .sort((a, b) => b.e1rm - a.e1rm)
          .map((t) => ({
            weight: t.kg,
            reps: t.reps,
            time: null,
            distance: null,
            date: timestamp(daysFromNow(t.day, "12:00", now)),
          })),
      };
    }),
  };
};
