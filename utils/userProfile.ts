import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { upsertEmailIndex } from "./emailIndex";
import { notifyBugsnag } from "./bugsnagDedup";
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
      photoURL: user.photoURL ?? "",
    };
    if (!userDoc.exists()) {
      profileData.createdAt = serverTimestamp();
    }

    const writes: Promise<void>[] = [];
    if (!settingsDoc.exists()) {
      writes.push(setDoc(privateSettingsRef, DEFAULT_PRIVACY_SETTINGS));
    }

    // The address lives in two places now: the hashed emailIndex entry that
    // friend search resolves, and a private document only the owner can read.
    // Neither is readable by another user, unlike the public profile field
    // this replaces.
    if (user.email) {
      await upsertEmailIndex(user.uid, user.email);
      writes.push(
        setDoc(
          doc(db, "users", user.uid, "private", "contact"),
          { email: user.email },
          { merge: true },
        ),
      );
      // Only once the index entry exists, so the account never becomes
      // unsearchable in between.
      if (userDoc.exists() && userDoc.data()?.email !== undefined) {
        profileData.email = deleteField();
      }
    }

    writes.push(setDoc(userRef, profileData, { merge: true }));
    await Promise.all(writes);
  } catch (error) {
    notifyBugsnag(error);
  }
};
