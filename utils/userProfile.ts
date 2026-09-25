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

    // The address lives in two places now: the hashed emailIndex entry that
    // friend search resolves, and a private document only the owner can read.
    // Neither is readable by another user, unlike the public profile field
    // this replaces. Awaited before anything else starts: if the index write
    // fails the profile must stay as it is, or the account ends up in neither
    // lookup path, and nothing else may be left in flight unobserved.
    //
    // Gated on emailVerified because the rules require a verified token email
    // to claim an index entry. Without the guard an unverified account would
    // throw permission-denied here and take the rest of the function with it,
    // which on a first sign-in means the default privacy settings never get
    // written. Google is the only provider the app offers and always verifies,
    // so this is belt and braces rather than a path anyone is on.
    if (user.email && user.emailVerified) {
      await upsertEmailIndex(user.uid, user.email);
    }

    // Unconditional, because the rules no longer allow `email` on a public
    // profile: a document still carrying one is rejected on every merge write
    // until the field is cleared, whether or not there was an address to index.
    if (userDoc.exists() && userDoc.data()?.email !== undefined) {
      profileData.email = deleteField();
    }

    const writes: Promise<void>[] = [];
    if (!settingsDoc.exists()) {
      writes.push(setDoc(privateSettingsRef, DEFAULT_PRIVACY_SETTINGS));
    }
    if (user.email) {
      writes.push(
        setDoc(
          doc(db, "users", user.uid, "private", "contact"),
          { email: user.email },
          { merge: true },
        ),
      );
    }
    writes.push(setDoc(userRef, profileData, { merge: true }));
    await Promise.all(writes);
  } catch (error) {
    notifyBugsnag(error);
  }
};
