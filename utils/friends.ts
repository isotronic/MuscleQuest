import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  limit,
  serverTimestamp,
} from "@react-native-firebase/firestore";

export interface UserSearchResult {
  uid: string;
  displayName: string;
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
  const requestId = `${fromUid}_${myUid}`;
  const db = getFirestore();
  const now = serverTimestamp();
  const batch = writeBatch(db);

  batch.set(doc(db, "users", myUid, "friends", fromUid), { since: now });
  batch.set(doc(db, "users", fromUid, "friends", myUid), { since: now });
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

// Returns null if no user found or if the result is the current user.
export const searchUserByEmail = async (
  email: string,
  currentUid: string,
): Promise<UserSearchResult | null> => {
  const db = getFirestore();
  const snapshot = await getDocs(
    query(
      collection(db, "users"),
      where("email", "==", email.toLowerCase().trim()),
      limit(1),
    ),
  );

  if (snapshot.empty) return null;

  const firstDoc = snapshot.docs[0];
  if (firstDoc.id === currentUid) return null;

  const data = firstDoc.data();
  return {
    uid: firstDoc.id,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL,
  };
};
