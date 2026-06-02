import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
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
    const db = firestore();
    const userRef = db.collection("users").doc(user.uid);
    const privateSettingsRef = userRef.collection("private").doc("settings");

    const [userDoc, settingsDoc] = await Promise.all([
      userRef.get(),
      privateSettingsRef.get(),
    ]);

    const profileData: Record<string, unknown> = {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
    };
    if (!userDoc.exists()) {
      profileData.createdAt = firestore.FieldValue.serverTimestamp();
    }

    const writes: Promise<void>[] = [userRef.set(profileData, { merge: true })];
    if (!settingsDoc.exists()) {
      writes.push(privateSettingsRef.set(DEFAULT_PRIVACY_SETTINGS));
    }

    await Promise.all(writes);
  } catch (error) {
    Bugsnag.notify(error as Error);
  }
};
