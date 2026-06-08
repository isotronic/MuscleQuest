import { getFirestore, doc, getDoc } from "@react-native-firebase/firestore";

export interface FriendProfile {
  displayName: string;
  email: string;
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
        email: data?.email ?? "",
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
