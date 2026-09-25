import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";

// No email: it is no longer on the public profile, and another user's
// address is not something this app shows (plan 07 phase C2).
export interface FriendProfile {
  displayName: string;
  photoURL: string;
}

export const fetchFriendProfile = async (
  friendUid: string,
  maxAttempts = 3,
  baseDelayMs = 2000,
): Promise<FriendProfile> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const db = getFirestore();
      const snap = await getDoc(doc(db, "users", friendUid));
      const data = snap.data();
      return {
        displayName: data?.displayName ?? "",
        photoURL: data?.photoURL ?? "",
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, (attempt + 1) * baseDelayMs),
        );
      }
    }
  }
  throw lastError;
};
