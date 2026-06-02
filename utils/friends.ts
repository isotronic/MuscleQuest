import firestore from "@react-native-firebase/firestore";

export interface UserSearchResult {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

// Always uses .set() (overwrite) so a re-request after decline replaces the
// existing document rather than failing or creating a duplicate.
export const sendFriendRequest = async (
  fromUid: string,
  toUid: string,
): Promise<void> => {
  const requestId = `${fromUid}_${toUid}`;
  await firestore().collection("friendRequests").doc(requestId).set({
    from: fromUid,
    to: toUid,
    status: "pending",
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

export const acceptFriendRequest = async (
  fromUid: string,
  myUid: string,
): Promise<void> => {
  const requestId = `${fromUid}_${myUid}`;
  const db = firestore();
  const now = firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.set(
    db.collection("users").doc(myUid).collection("friends").doc(fromUid),
    { since: now },
  );
  batch.set(
    db.collection("users").doc(fromUid).collection("friends").doc(myUid),
    { since: now },
  );
  batch.update(db.collection("friendRequests").doc(requestId), {
    status: "accepted",
  });

  await batch.commit();
};

export const declineFriendRequest = async (
  fromUid: string,
  myUid: string,
): Promise<void> => {
  const requestId = `${fromUid}_${myUid}`;
  await firestore()
    .collection("friendRequests")
    .doc(requestId)
    .update({ status: "declined" });
};

export const removeFriend = async (
  myUid: string,
  friendUid: string,
): Promise<void> => {
  const db = firestore();
  const batch = db.batch();

  batch.delete(
    db.collection("users").doc(myUid).collection("friends").doc(friendUid),
  );
  batch.delete(
    db.collection("users").doc(friendUid).collection("friends").doc(myUid),
  );

  // Also clean up the friend request document in both possible directions.
  // We don't know which user initiated the original request, so delete both.
  batch.delete(db.collection("friendRequests").doc(`${myUid}_${friendUid}`));
  batch.delete(db.collection("friendRequests").doc(`${friendUid}_${myUid}`));

  await batch.commit();
};

// Returns null if no user found or if the result is the current user.
export const searchUserByEmail = async (
  email: string,
  currentUid: string,
): Promise<UserSearchResult | null> => {
  const snapshot = await firestore()
    .collection("users")
    .where("email", "==", email.toLowerCase().trim())
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  if (doc.id === currentUid) return null;

  const data = doc.data();
  return {
    uid: doc.id,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL,
  };
};
