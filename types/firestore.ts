import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export interface FirestoreUser {
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface FirestorePrivateSettings {
  sharePlans: boolean;
  shareStandaloneWorkouts: boolean;
  shareCustomExercises: boolean;
  shareCompletedWorkouts: boolean;
  shareBodyMeasurements: boolean;
  shareStrengthProgress: boolean;
}

export interface FriendRequest {
  from: string;
  to: string;
  status: "pending" | "accepted" | "declined";
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface FriendEntry {
  since: FirebaseFirestoreTypes.Timestamp;
}

// Enriched friend shape used in the UI (profile data joined in)
export interface FriendInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  since: FirebaseFirestoreTypes.Timestamp;
}

// Shared plan / standalone workout shapes
export interface SharedExerciseSet {
  repsMin: number | null;
  repsMax: number | null;
  restMinutes: number;
  restSeconds: number;
  time: number | null;
  distance: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

export interface SharedExercise {
  appExerciseId: number | null;
  name: string;
  equipment: string;
  bodyPart: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  trackingType: string;
  isUnilateral: boolean;
  doubleWeight: boolean;
  animatedUrl: string | null;
  sets: SharedExerciseSet[];
  exerciseOrder: number;
  supersetGroupId: string | null;
  trackingTypeOverride: string | null;
}

export interface SharedWorkoutItem {
  name: string;
  workoutOrder: number;
  exercises: SharedExercise[];
}

export interface SharedPlan {
  localPlanId: number;
  name: string;
  imageUrl: string | null;
  publishedAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  workouts: SharedWorkoutItem[];
}

export interface SharedStandaloneWorkout {
  localWorkoutId: number;
  name: string;
  imageUrl: string | null;
  publishedAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  exercises: SharedExercise[];
}

export interface SharedCustomExercise {
  localExerciseId: number;
  name: string;
  equipment: string;
  bodyPart: string;
  targetMuscle: string;
  secondaryMuscles: string[];
  description: string | null;
  trackingType: string;
  isUnilateral: boolean;
  doubleWeight: boolean;
  animatedUrl: string | null;
  publishedAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface SharedCompletedSet {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  isToFailure: boolean;
}

export interface SharedCompletedExercise {
  name: string;
  sets: SharedCompletedSet[];
}

export interface SharedCompletedWorkout {
  localWorkoutId: number;
  planName: string | null;
  workoutName: string | null;
  dateCompleted: FirebaseFirestoreTypes.Timestamp;
  durationSeconds: number;
  totalSetsCompleted: number;
  isDeload: boolean;
  exercises: SharedCompletedExercise[];
}

export interface SharedMeasurement {
  localEntryId: number;
  recordedAt: FirebaseFirestoreTypes.Timestamp;
  values: Record<string, number>;
}

export interface SharedStrengthSet {
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  date: FirebaseFirestoreTypes.Timestamp;
}

export interface SharedStrengthPR {
  exerciseName: string;
  appExerciseId: number | null;
  trackingType: string;
  allTimePR: number;
  allTimePRDate: FirebaseFirestoreTypes.Timestamp;
  topPRSets: SharedStrengthSet[];
}
