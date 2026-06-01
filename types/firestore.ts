import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

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
  status: 'pending' | 'accepted' | 'declined';
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
