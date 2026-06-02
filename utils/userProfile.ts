import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import Bugsnag from "@bugsnag/expo";
import { FirestorePrivateSettings } from "../types/firestore";

const DEFAULT_PRIVACY_SETTINGS: FirestorePrivateSettings = {
  sharePlans: false,
  shareStandaloneWorkouts: false,
  shareCustomExercises: false,
  shareCompletedWorkouts: false,
  shareBodyMeasurements: false,
  shareStrengthProgress: false,
};

export const upsertUserProfile = async (
  user: FirebaseAuthTypes.User,
): Promise<void> => {
  try {
    const db = getFirestore();
    const userRef = doc(db, "users", user.uid);
    const privateSettingsRef = doc(
      db,
      "users",
      user.uid,
      "private",
      "settings",
    );

    const [userDoc, settingsDoc] = await Promise.all([
      getDoc(userRef),
      getDoc(privateSettingsRef),
    ]);

    const profileData: Record<string, unknown> = {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
    };
    if (!userDoc.exists()) {
      profileData.createdAt = serverTimestamp();
    }

    const writes: Promise<void>[] = [
      setDoc(userRef, profileData, { merge: true }),
    ];
    if (!settingsDoc.exists()) {
      writes.push(setDoc(privateSettingsRef, DEFAULT_PRIVACY_SETTINGS));
    }

    await Promise.all(writes);
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};
