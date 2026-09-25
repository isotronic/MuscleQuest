import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  limit,
  serverTimestamp,
} from "@react-native-firebase/firestore";
import { fetchFriendProfile } from "./fetchFriendProfile";
import { lookupUidByEmail } from "./emailIndex";

export interface UserSearchResult {
  uid: string;
  displayName: string;
  // The address the caller searched for, echoed back. Never read off the
  // matched user's profile.
  email: string;
  photoURL: string;
}

// Always uses setDoc (overwrite) so a re-request after decline replaces the
// existing document rather than failing or creating a duplicate.
export const sendFriendRequest = async (
  fromUid: string,
  toUid: string,
): Promise<void> => {
  const requestId = `${fromUid}_${toUid}`;
  const db = getFirestore();
  await setDoc(doc(db, "friendRequests", requestId), {
    from: fromUid,
    to: toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

export const acceptFriendRequest = async (
  fromUid: string,
  myUid: string,
): Promise<void> => {
  const [fromProfile, myProfile] = await Promise.all([
    fetchFriendProfile(fromUid),
    fetchFriendProfile(myUid),
  ]);

  const requestId = `${fromUid}_${myUid}`;
  const db = getFirestore();
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.set(doc(db, "users", myUid, "friends", fromUid), {
    since: now,
    displayName: fromProfile.displayName,
    photoURL: fromProfile.photoURL,
  });
  batch.set(doc(db, "users", fromUid, "friends", myUid), {
    since: now,
    displayName: myProfile.displayName,
    photoURL: myProfile.photoURL,
  });
  batch.update(doc(db, "friendRequests", requestId), { status: "accepted" });

  await batch.commit();
};

export const declineFriendRequest = async (
  fromUid: string,
  myUid: string,
): Promise<void> => {
  const requestId = `${fromUid}_${myUid}`;
  const db = getFirestore();
  await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
};

export const removeFriend = async (
  myUid: string,
  friendUid: string,
): Promise<void> => {
  const db = getFirestore();
  const batch = writeBatch(db);

  batch.delete(doc(db, "users", myUid, "friends", friendUid));
  batch.delete(doc(db, "users", friendUid, "friends", myUid));

  // Also clean up the friend request document in both possible directions.
  // We don't know which user initiated the original request, so delete both.
  batch.delete(doc(db, "friendRequests", `${myUid}_${friendUid}`));
  batch.delete(doc(db, "friendRequests", `${friendUid}_${myUid}`));

  await batch.commit();
};

// Legacy search: queries the public profile's `email` field. Only reached for
// accounts that have not signed in since the emailIndex shipped, so they have
// no index entry yet. Goes away with the `list` rule on /users once adoption
// is high enough (plan 07 phase C3).
const searchLegacyProfileByEmail = async (
  normalisedEmail: string,
  currentUid: string,
): Promise<UserSearchResult | null> => {
  const db = getFirestore();
  const snapshot = await getDocs(
    query(
      collection(db, "users"),
      where("email", "==", normalisedEmail),
      limit(1),
    ),
  );

  if (snapshot.empty) return null;

  const firstDoc = snapshot.docs[0];
  if (firstDoc.id === currentUid) return null;

  const data = firstDoc.data();
  return {
    uid: firstDoc.id,
    displayName: data.displayName ?? "",
    email: normalisedEmail,
    photoURL: data.photoURL ?? "",
  };
};

// Returns null if no user found or if the result is the current user.
//
// Looks the address up through emailIndex, which reveals nothing but whether
// a match exists, then hydrates the display name and photo from the matched
// profile. The returned email is the one the caller typed, never one read off
// someone else's profile.
export const searchUserByEmail = async (
  email: string,
  currentUid: string,
): Promise<UserSearchResult | null> => {
  const normalisedEmail = email.toLowerCase().trim();

  const uid = await lookupUidByEmail(normalisedEmail);
  if (!uid) {
    return searchLegacyProfileByEmail(normalisedEmail, currentUid);
  }
  if (uid === currentUid) return null;

  const db = getFirestore();
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    uid,
    displayName: data?.displayName ?? "",
    email: normalisedEmail,
    photoURL: data?.photoURL ?? "",
  };
};
